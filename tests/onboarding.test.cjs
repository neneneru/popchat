'use strict';
// Independent onboarding revision audit using packaged markup/scripts and deterministic API doubles.
// This does not establish computed CSS, real Chromium rendering, or live Twitch behavior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Document, emit, flush} = require('./helpers/mock-browser.cjs');
const extension = path.join(__dirname, '../extension');
const read = file => fs.readFileSync(path.join(extension, file), 'utf8');
const locales = ['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const catalog = locale => JSON.parse(read(`_locales/${locale}/messages.json`));
const controls = ['consent-enable','consent-disable','consent-later'];

function storageHub(stored) {
  let value = stored;
  const listeners = new Set(), writes = [];
  function change(next, area='local', key='tccConsentVersion') {
    const oldValue = value;
    if (area === 'local' && key === 'tccConsentVersion') value = next;
    const changes = {[key]: next === undefined ? {oldValue} : {oldValue,newValue:next}};
    for (const listener of [...listeners]) listener(changes, area);
  }
  return {listeners,writes,change,get value() { return value; },set value(next) { value = next; }};
}

function pageHarness(page='onboarding', {locale='en',hub=storageHub(),deferRead=false,deferWrite=false,deferOpen=false,
  readError=false,writeError=false,openError=false,throwRead=false,throwWrite=false,throwOpen=false,autoEvent=true}={}) {
  const document = new Document();
  for (const [,tag,attributes] of read(`${page}.html`).matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    if (!/\bid=|\bdata-i18n=/.test(attributes)) continue;
    const element = document.createElement(tag);
    for (const [,key,value] of attributes.matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)) element.setAttribute(key,value);
    element.hidden = /\bhidden\b/.test(attributes);
    element.disabled = /\bdisabled\b/.test(attributes);
    document.body.append(element);
  }
  const window = new EventTarget();
  let closed=0,opened=0;
  window.close=()=>{closed++;emit(window,'pagehide',{persisted:false});};
  const pendingReads=[],pendingWrites=[],pendingOpens=[],ownListeners=new Set(),readKeys=[];
  const runtime={getManifest:()=>({version:JSON.parse(read('manifest.json')).version})};
  function invoke(callback, error, value) {
    if (error) runtime.lastError={message:'Synthetic extension API failure'};
    try { callback?.(value); } finally { delete runtime.lastError; }
  }
  runtime.openOptionsPage=callback=>{
    opened++;
    if (throwOpen) throw new Error('Context no longer available');
    if (callback) {
      const complete=()=>invoke(callback,openError);
      if (deferOpen) pendingOpens.push(complete); else complete();
      return undefined;
    }
    return new Promise((resolve,reject)=>{
      const complete=()=>openError?reject(new Error('Options page unavailable')):resolve();
      if (deferOpen) pendingOpens.push(complete); else complete();
    });
  };
  const storage={onChanged:{
    addListener(listener) { ownListeners.add(listener); hub.listeners.add(listener); },
    removeListener(listener) { ownListeners.delete(listener); hub.listeners.delete(listener); }
  },local:{
    get(key,callback) {
      readKeys.push(key); assert.equal(key,'tccConsentVersion','extension pages only read the consent key');
      if (throwRead) throw new Error('Context no longer available');
      const before=hub.value;
      const complete=()=>invoke(callback,readError,before===undefined?{}:{tccConsentVersion:before});
      if (deferRead) pendingReads.push(complete); else complete();
    },
    set(update,callback) {
      if (throwWrite) throw new Error('Context no longer available');
      const serialized=JSON.parse(JSON.stringify(update));
      assert.deepEqual(Object.keys(serialized),['tccConsentVersion'],'no additional storage key is introduced');
      hub.writes.push(serialized);
      const complete=()=>{
        if (!writeError) {
          if (autoEvent) hub.change(update.tccConsentVersion); else hub.value=update.tccConsentVersion;
        }
        invoke(callback,writeError);
      };
      // Deferred writes have separate commit and acknowledgement for real event/callback races.
      if (deferWrite) pendingWrites.push({
        commit() { if (!writeError) { if (autoEvent) hub.change(update.tccConsentVersion); else hub.value=update.tccConsentVersion; } },
        acknowledge() { invoke(callback,writeError); }, complete
      }); else complete();
    }
  }};
  const c=catalog(locale);
  const i18n={getMessage(key) {
    if (key==='@@ui_locale') return locale;
    if (key==='@@bidi_dir') return locale==='ar'?'rtl':'ltr';
    return c[key]?.message || '';
  }};
  const context=vm.createContext({document,window,chrome:{runtime,storage,i18n},console:{warn(){}},queueMicrotask,AbortController});
  vm.runInContext(read('i18n.js'),context,{filename:'i18n.js'});
  vm.runInContext(read(`${page}.js`),context,{filename:`${page}.js`});
  return {document,window,runtime,hub,ownListeners,pendingReads,pendingWrites,pendingOpens,readKeys,
    el:id=>document.querySelector(`#${id}`), get opened() {return opened;},get closed() {return closed;}};
}
function enabled(h, expected) {
  assert.equal(h.el('consent-active').hidden,!expected);
  assert.equal(h.el('consent-prompt').hidden,expected);
}
function unlocked(h) { for (const id of controls) assert.equal(!!h.el(id).disabled,false,id); }
function dispose(h) { emit(h.window,'pagehide',{persisted:false}); }
function button(h) {
  const buttons=h.document.querySelectorAll('button');
  assert.equal(buttons.length,1,'compact popup has exactly one action');
  return buttons[0];
}
function statusText(h) {
  return h.document.querySelectorAll('[role="status"]').map(node=>node.textContent).join(' ');
}

function backgroundHarness({throwOpen=false,rejectOpen=false,deferOpen=false}={}) {
  const installed=[],startup=[],pending=[];
  let opened=0;
  const runtime={onInstalled:{addListener:listener=>installed.push(listener)},onStartup:{addListener:listener=>startup.push(listener)},
    openOptionsPage(callback) {
      opened++;
      if (throwOpen) throw new Error('Options unavailable');
      if (callback) {
        if (rejectOpen) runtime.lastError={message:'Options unavailable'};
        callback(); delete runtime.lastError; return;
      }
      if(deferOpen)return new Promise((resolve,reject)=>pending.push(()=>rejectOpen?reject(new Error('Options unavailable')):resolve()));
      return rejectOpen?Promise.reject(new Error('Options unavailable')):Promise.resolve();
    }};
  const chrome=new Proxy({runtime},{get(target,key) { assert.equal(key,'runtime','background must not inspect tabs or storage');return target[key]; }});
  vm.runInNewContext(read('background.js'),{chrome,console:{warn(){}}},{filename:'background.js'});
  return {installed,startup,pending,get opened() {return opened;}};
}

test('onboarding: installation uses native options-tab routing with only storage permission', () => {
  const manifest=JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.permissions,['storage']);
  assert.deepEqual(manifest.background,{service_worker:'background.js'});
  assert.deepEqual(manifest.options_ui,{page:'onboarding.html',open_in_tab:true});
  assert.equal(manifest.action.default_popup,'help.html');
  for (const key of ['host_permissions','optional_permissions','optional_host_permissions','externally_connectable','web_accessible_resources']) assert.equal(manifest[key],undefined,key);
  assert.doesNotMatch(read('background.js')+read('help.js')+read('onboarding.js'),/chrome\.tabs|browser\.tabs|tabs\.query|window\.open\s*\(|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test('onboarding: only fresh install opens options; update, startup, and other reasons stay quiet', async () => {
  const h=backgroundHarness();
  assert.equal(h.installed.length,1);assert.equal(h.startup.length,0);assert.equal(h.opened,0);
  for (const reason of ['update','chrome_update','shared_module_update',undefined,'']) h.installed[0]({reason});
  await flush();assert.equal(h.opened,0);
  h.installed[0]({reason:'install'});await flush();assert.equal(h.opened,1);
});

for (const error of ['throwOpen','rejectOpen']) test(`onboarding: install ${error} is handled without another tab or fallback`, async () => {
  const h=backgroundHarness({[error]:true});
  assert.doesNotThrow(()=>h.installed[0]({reason:'install'}));
  await flush();assert.equal(h.opened,1);
});

for (const value of [undefined,0,'1',true,2,-1,null,{},[]]) test(`onboarding: consent ${JSON.stringify(value)} stays disabled without a write`, () => {
  const hub=storageHub(value),h=pageHarness('onboarding',{hub});
  enabled(h,false);assert.equal(hub.writes.length,0);dispose(h);
});

test('onboarding: multiple open pages and popup follow enable, revoke, and key removal immediately', () => {
  const hub=storageHub();
  const a=pageHarness('onboarding',{hub}),b=pageHarness('onboarding',{hub}),popup=pageHarness('help',{hub});
  const initially=statusText(popup);
  a.el('consent-enable').click(); enabled(a,true); enabled(b,true);
  assert.notEqual(statusText(popup),initially);
  b.el('consent-disable').click(); enabled(a,false);enabled(b,false);assert.equal(statusText(popup),initially);
  hub.change(1);enabled(a,true);enabled(b,true);
  hub.change(undefined);enabled(a,false);enabled(b,false);assert.equal(statusText(popup),initially);
  assert.deepEqual(hub.writes,[{tccConsentVersion:1},{tccConsentVersion:0}]);
  for (const page of [a,b,popup]) {dispose(page);assert.equal(page.ownListeners.size,0);}
});

for (const page of ['onboarding','help']) test(`${page}: old read cannot replace newer cross-tab consent or unrelated events`, () => {
  const hub=storageHub(),h=pageHarness(page,{hub,deferRead:true});
  hub.change(1); const active=page==='onboarding'?h.el('consent-active').hidden:statusText(h);
  hub.change(0,'sync');hub.change(0,'local','tccPreferences');
  h.pendingReads.shift()();
  if (page==='onboarding') enabled(h,true);else assert.equal(statusText(h),active);
  hub.change(0);if(page==='onboarding')enabled(h,false);else assert.notEqual(statusText(h),active);
  dispose(h);
});

test('onboarding: synthetic repeated clicks cannot issue duplicate writes while pending', () => {
  const h=pageHarness('onboarding',{deferWrite:true});
  emit(h.el('consent-enable'),'click');
  for (const id of controls) emit(h.el(id),'click');
  assert.deepEqual(h.hub.writes,[{tccConsentVersion:1}]);
  for (const id of controls) assert.equal(h.el(id).disabled,true,id);
  h.pendingWrites.shift().complete();enabled(h,true);unlocked(h);assert.equal(h.closed,0);dispose(h);
});

for (const choice of [0,1]) test(`onboarding: delayed ${choice} write acknowledgement never undoes newer external ${1-choice}`, () => {
  const h=pageHarness('onboarding',{hub:storageHub(1-choice),deferWrite:true});
  h.el(choice?'consent-enable':'consent-disable').click();
  const write=h.pendingWrites.shift();write.commit();h.hub.change(1-choice);write.acknowledge();
  enabled(h,!!(1-choice));unlocked(h);
  assert.equal(h.hub.writes.length,1);dispose(h);
});

test('onboarding: callback-first completion works even when storage emits no event', () => {
  const h=pageHarness('onboarding',{autoEvent:false});
  h.el('consent-enable').click();enabled(h,true);unlocked(h);
  h.el('consent-disable').click();enabled(h,false);unlocked(h);dispose(h);
});

for (const page of ['onboarding','help']) test(`${page}: permanent pagehide removes listeners and invalidates stale read and actions`, async () => {
  const h=pageHarness(page,{deferRead:true});
  assert.equal(h.ownListeners.size,1);
  const before=h.document.body.textContent;
  dispose(h);assert.equal(h.ownListeners.size,0);
  h.hub.change(1);h.pendingReads.shift()();
  emit(h.window,'pageshow',{persisted:true});
  for (const element of h.document.querySelectorAll('button')) emit(element,'click');
  await flush();
  assert.equal(h.hub.writes.length,0);assert.equal(h.opened,0);assert.equal(h.document.body.textContent,before);
});

test('onboarding: disposed write callback cannot render a now-destroyed page', () => {
  const h=pageHarness('onboarding',{deferWrite:true});
  h.el('consent-enable').click();dispose(h);const before=h.document.body.textContent;
  h.pendingWrites.shift().complete();
  assert.equal(h.document.body.textContent,before);assert.equal(h.ownListeners.size,0);
});

for (const page of ['onboarding','help']) test(`${page}: BFCache resumes latest stored state and remains interactive without duplicate listeners`, async () => {
  const hub=storageHub(1),h=pageHarness(page,{hub});
  emit(h.window,'pagehide',{persisted:true});hub.change(0);
  emit(h.window,'pageshow',{persisted:true});
  assert.equal(h.ownListeners.size,1);
  if (page==='onboarding') enabled(h,false);
  for(let i=0;i<3;i++) {emit(h.window,'pagehide',{persisted:true});emit(h.window,'pageshow',{persisted:true});}
  assert.equal(h.ownListeners.size,1);
  if (page==='onboarding') {h.el('consent-enable').click();enabled(h,true);}
  else {button(h).click();await flush();assert.equal(h.opened,1);assert.equal(h.closed,1);}
  dispose(h);
});

for (const locale of locales) test(`onboarding: ${locale} both extension pages localize every exposed element and reading direction`, () => {
  for (const page of ['onboarding','help']) {
    const h=pageHarness(page,{locale});
    assert.equal(h.document.title,catalog(locale).extensionName.message);
    if(page==='onboarding')assert.equal(h.el('version').textContent,JSON.parse(read('manifest.json')).version);
    assert.equal(h.document.documentElement.lang,locale.replaceAll('_','-'));
    assert.equal(h.document.documentElement.dir,locale==='ar'?'rtl':'ltr');
    for (const element of h.document.querySelectorAll('[data-i18n]')) {
      const key=element.getAttribute('data-i18n');
      assert.ok(catalog(locale)[key]?.message.trim(),`${page}: ${locale}:${key}`);
      assert.equal(element.textContent,catalog(locale)[key].message,`${page}: ${locale}:${key}`);
    }
    assert.ok(h.document.body.textContent.trim());dispose(h);
  }
});

test('onboarding: compact action popup routes to options without changing consent or opening a player', async () => {
  for(const stored of [undefined,0,1]) {
    const h=pageHarness('help',{hub:storageHub(stored)});
    for(const id of controls)assert.equal(h.el(id),null);
    assert.ok(statusText(h).trim(),'popup explains current consent state');
    button(h).click();await flush();assert.equal(h.opened,1);assert.equal(h.hub.value,stored);assert.equal(h.hub.writes.length,0);
    dispose(h);
  }
});

test('onboarding: repeated options clicks are deduplicated until native request completes', async () => {
  const h=pageHarness('help',{deferOpen:true});
  const open=button(h);emit(open,'click');emit(open,'click');emit(open,'click');
  assert.equal(h.opened,1);h.pendingOpens.shift()();await flush();
  assert.equal(h.closed,1,'successful routing closes the compact popup');assert.equal(h.hub.writes.length,0);dispose(h);
});

for(const error of ['openError','throwOpen']) test(`onboarding: compact popup ${error} is visible and retry remains possible`, async () => {
  const h=pageHarness('help',{[error]:true});const initial=statusText(h);
  button(h).click();await flush();
  assert.equal(h.opened,1);assert.ok(statusText(h).trim());assert.notEqual(statusText(h),initial);
  assert.equal(!!button(h).disabled,false);assert.equal(h.hub.writes.length,0);dispose(h);
});

test('onboarding: standalone help pages have white/light responsive source rules without remote content', () => {
  for (const page of ['help','onboarding']) {
    const html=read(`${page}.html`),css=read(`${page}.css`);
    assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1"/);
    assert.match(html,/<script src="i18n.js" defer>/);
    assert.match(html,new RegExp(`<script src="${page}\\.js" defer>`));
    assert.doesNotMatch(html,/<(?:iframe|video|canvas)\b|\son\w+=|src="https?:/i);
    if(page==='help')assert.doesNotMatch(html,/<a\s/i,'compact popup has no alternative launcher link');
    assert.match(css,/color-scheme\s*:\s*light\s*[;}]/);
    assert.match(css,/background(?:-color)?\s*:\s*(?:#fff(?:fff)?|white)(?:\s*[;}])/i);
    assert.doesNotMatch(css,/prefers-color-scheme\s*:\s*dark|overflow(?:-[xy])?\s*:\s*(?:hidden|clip)/i);
    for (const [,selector,rule] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
      if (/\bimg\s*$/.test(selector)) continue; // Icon dimensions do not clip text at 200% zoom.
      assert.doesNotMatch(rule,/(?:^|[;]\s*)height\s*:\s*\d+(?:px|rem|vh)\b/m);
    }
    assert.match(css,/overflow-wrap\s*:\s*(?:anywhere|break-word)/);
  }
});

test('onboarding: cross-tab events never unlock a still-pending write or permit a second action', () => {
  const h=pageHarness('onboarding',{deferWrite:true});
  h.el('consent-enable').click();const write=h.pendingWrites.shift();write.commit();
  for(const id of controls) assert.equal(h.el(id).disabled,true,`${id}: write callback is still pending`);
  h.hub.change(0);
  for(const id of controls) {assert.equal(h.el(id).disabled,true);emit(h.el(id),'click');}
  assert.equal(h.hub.writes.length,1);write.acknowledge();enabled(h,false);unlocked(h);dispose(h);
});

for(const error of ['writeError','throwWrite']) test(`onboarding: failed revoke (${error}) preserves enabled state and offers retry`, () => {
  const h=pageHarness('onboarding',{hub:storageHub(1),[error]:true});
  enabled(h,true);h.el('consent-disable').click();
  enabled(h,true);unlocked(h);assert.equal(h.hub.value,1);
  assert.equal(h.el('consent-status').textContent,catalog('en').consentSaveError.message);dispose(h);
});

for(const page of ['onboarding','help']) test(`${page}: failed stale read cannot add an error after a newer valid event`, () => {
  const h=pageHarness(page,{deferRead:true,readError:true});
  h.hub.change(1);const before=h.document.body.textContent;h.pendingReads.shift()();
  assert.equal(h.document.body.textContent,before);
  if(page==='onboarding')enabled(h,true);else assert.equal(h.el('popup-state').textContent,catalog('en').popupEnabled.message);
  dispose(h);
});

for(const completion of ['before restore','after restore']) test(`onboarding: pending enable ${completion} across BFCache resolves to persisted consent`, () => {
  const h=pageHarness('onboarding',{deferWrite:true});
  h.el('consent-enable').click();const write=h.pendingWrites.shift();
  emit(h.window,'pagehide',{persisted:true});
  if(completion==='before restore')write.complete();
  emit(h.window,'pageshow',{persisted:true});
  if(completion==='after restore')write.complete();
  enabled(h,true);unlocked(h);assert.equal(h.hub.writes.length,1);dispose(h);
});

for(const page of ['onboarding','help']) test(`${page}: BFCache reads fresh state even when no change event was delivered`, () => {
  const h=pageHarness(page,{hub:storageHub(1)});
  emit(h.window,'pagehide',{persisted:true});h.hub.value=0;
  emit(h.window,'pageshow',{persisted:true});
  if(page==='onboarding')enabled(h,false);else assert.equal(h.el('popup-state').textContent,catalog('en').popupDisabled.message);
  assert.ok(h.readKeys.length>=2);dispose(h);
});

test('onboarding: deferred reads from a former BFCache visit cannot replace the restored read', () => {
  const h=pageHarness('onboarding',{hub:storageHub(1),deferRead:true});
  emit(h.window,'pagehide',{persisted:true});h.hub.value=0;
  emit(h.window,'pageshow',{persisted:true});
  const old=h.pendingReads.shift(),current=h.pendingReads.shift();current();enabled(h,false);old();enabled(h,false);unlocked(h);dispose(h);
});

test('onboarding: actual settings writes activate an already-open Twitch page and revoke a live PiP', async () => {
  const {createHarness,deepElements}=require('./helpers/mock-browser.cjs');
  const twitch=createHarness({locale:'en',consent:false});
  const hub=storageHub(),settings=pageHarness('onboarding',{hub});
  const relay=(changes,area)=>{for(const listener of twitch.storageListeners)listener(changes,area);};
  hub.listeners.add(relay);twitch.openGear();
  assert.equal(twitch.document.querySelector('[data-tcc-gear-entry]'),null);
  settings.el('consent-enable').click();
  const entry=twitch.button(catalog('en').gearEntry.message);assert.ok(entry);entry.click();await flush();
  const pip=twitch.pipWindows[0];assert.equal(twitch.video.ownerDocument,pip.document);
  assert.equal(deepElements(pip.document.documentElement).filter(node=>node.tagName==='IFRAME').length,1);
  settings.el('consent-disable').click();
  assert.equal(pip.closed,true);assert.equal(twitch.video.parentNode,twitch.container);assert.equal(twitch.video.pauseCount,0);
  assert.equal(twitch.document.querySelector('[data-tcc-gear-entry]'),null);
  assert.equal(twitch.document.querySelector('#tcc-placeholder'),null);
  assert.equal(twitch.timers.size,0);assert.equal(twitch.writes.length,0);
  dispose(settings);hub.listeners.delete(relay);emit(twitch.window,'pagehide',{persisted:false});
});

for (const openError of [false,true]) test(`onboarding: pre-BFCache options ${openError?'failure':'success'} cannot close or alter the restored popup`, async () => {
  const h=pageHarness('help',{deferOpen:true,openError});
  button(h).click();const old=h.pendingOpens.shift();
  emit(h.window,'pagehide',{persisted:true});emit(h.window,'pageshow',{persisted:true});
  const before=h.document.body.textContent;old();await flush();
  assert.equal(h.closed,0);assert.equal(!!button(h).disabled,false);assert.equal(h.document.body.textContent,before);
  button(h).click();assert.equal(h.opened,2);h.pendingOpens.shift()();await flush();
  assert.equal(h.closed,openError?0:1);dispose(h);
});

test('onboarding: pending options result is ignored after the popup is permanently disposed', async () => {
  const h=pageHarness('help',{deferOpen:true});button(h).click();dispose(h);
  h.pendingOpens.shift()();await flush();assert.equal(h.closed,0);assert.equal(h.ownListeners.size,0);
});

test('onboarding: authoritative consent event clears a recovered popup storage-read error', () => {
  const h=pageHarness('help',{readError:true});
  assert.equal(h.el('popup-error').textContent,catalog('en').consentSaveError.message);
  h.hub.change(1);assert.equal(h.el('popup-state').textContent,catalog('en').popupEnabled.message);
  assert.equal(h.el('popup-error').textContent,'');dispose(h);
});

test('onboarding: every locale key is referenced and retired popup/disclosure keys are absent', () => {
  const runtime=fs.readdirSync(extension).filter(name=>/\.(?:js|html|json)$/.test(name)).map(read).join('\n');
  const retired=['helpTagline','helpHeaderInstruction','helpPrivacy','helpPermissions','consentBody'];
  for(const locale of locales) {
    const c=catalog(locale);
    for(const key of retired)assert.equal(c[key],undefined,`${locale}: retired ${key}`);
    for(const key of Object.keys(c)) assert.ok(runtime.includes(`'${key}'`)||runtime.includes(`"${key}"`)||runtime.includes(`__MSG_${key}__`),`${locale}: unused ${key}`);
  }
});


test('onboarding: repeated install notifications do not duplicate a pending native options request', async () => {
  const h=backgroundHarness({deferOpen:true});
  h.installed[0]({reason:'install'});h.installed[0]({reason:'install'});h.installed[0]({reason:'update'});
  assert.equal(h.opened,1);h.pending.shift()();await flush();assert.equal(h.opened,1);
});
