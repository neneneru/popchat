'use strict';
// Consent/privacy gating and lifecycle checks using deterministic DOM/API doubles.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHarness, Document, deepElements, emit, flush} = require('./helpers/mock-browser.cjs');
const extension = path.join(__dirname, '../extension');
const locales = ['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const catalog = locale => JSON.parse(fs.readFileSync(path.join(extension, '_locales', locale, 'messages.json'), 'utf8'));
const frames = doc => deepElements(doc.documentElement).filter(node => node.tagName === 'IFRAME');
const ownEntries = h => h.document.querySelectorAll('[data-tcc-gear-entry]');
const topLabel = catalog('en').gearEntry.message;
const permanentExit = h => emit(h.window, 'pagehide', {persisted:false});
function inactive(h) {
  assert.equal(ownEntries(h).length, 0);
  assert.equal(h.document.querySelector('#tcc-panel'), null);
  assert.equal(h.document.querySelector('#tcc-placeholder'), null);
  assert.equal(frames(h.document).length, 0);
  assert.equal(h.observers.filter(observer => observer.active).length, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.video.parentNode, h.container);
}

for (const url of ['https://www.twitch.tv/example','https://player.twitch.tv/?channel=example','https://www.twitch.tv/example/popout']) {
  test(`consent: missing consent prevents all player/menu inspection and activation on ${url}`, () => {
    const inspected = [];
    const h = createHarness({url,locale:'en',consent:false,preferences:{mode:'side',width:1440,height:900},setup({document}) {
      const original = document.querySelectorAll.bind(document);
      document.querySelectorAll = selector => { inspected.push(selector); return original(selector); };
    }});
    assert.deepEqual(inspected, [], 'no page inspection before consent');
    assert.equal(h.pipRequests.length, 0);
    assert.equal(h.opened.length, 0);
    assert.equal(h.writes.length, 0);
    const inspectedBefore = inspected.length;
    emit(h.window, 'focus'); emit(h.document, 'loadedmetadata'); emit(h.document, 'playing'); emit(h.window.navigation, 'navigatesuccess');
    h.runTimers();
    assert.equal(inspected.length, inspectedBefore, 'passive lifecycle events do not inspect the page');
    inactive(h);
    h.openGear(); inactive(h);
    permanentExit(h);
    assert.equal(h.storageListeners.size, 0);
    assert.equal(h.writes.length, 0, 'no preference write without affirmative consent');
  });
}

test('consent: only the numeric current version enables; old preferences and truthy values do not', () => {
  for (const value of [0,'1',true,2,-1,{},[]]) {
    const h = createHarness({consent:value,locale:'en',url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1500,height:800}});
    inactive(h); assert.equal(h.writes.length, 0); permanentExit(h);
  }
  const h = createHarness({consent:false,locale:'en'});
  h.openGear();
  for (const value of [undefined,null,false,'1',2]) { h.changeConsent(value); inactive(h); }
  h.changeConsent(1);
  assert.equal(ownEntries(h).length, 1);
  assert.equal(h.writes.length, 0, 'enabling never rewrites existing preferences');
  permanentExit(h);
});

test('consent: enabling activates an existing native popout immediately and preserves old preferences', () => {
  const h = createHarness({consent:false,locale:'en',url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1440,height:900}});
  inactive(h); h.changeConsent(1);
  assert.equal(frames(h.document).length, 1);
  assert.equal(h.button('HIDE').getAttribute('aria-pressed'), 'true');
  assert.equal(h.pipRequests.length, 0);
  assert.equal(h.video.parentNode, h.container);
  assert.equal(h.writes.length, 0);
  h.changeConsent(0); inactive(h);
  h.changeConsent(1); assert.equal(frames(h.document).length, 1);
  assert.equal(h.button('HIDE').getAttribute('aria-pressed'), 'true');
  permanentExit(h);
});

test('consent: revocation closes active PiP, restores exact video state, and disables stale callbacks', async () => {
  let nativeCalls = 0;
  const h = createHarness({locale:'en'});
  const next = h.document.createElement('span'); h.container.append(next);
  h.video.setAttribute('style', 'opacity: 0.7 !important;'); const style = h.video.getAttribute('style'); h.video.controls = false;
  const {nativeButton,nativeRow} = h.openGear({nativeAction:() => nativeCalls++});
  const nativeAttributes = [...nativeButton.attributes]; const entry = h.button(topLabel);
  await h.click(topLabel); const win = h.pipWindows[0]; const frame = frames(win.document)[0];
  const chat = h.button(catalog('en').separateLabel.message,win.document);
  const mode = h.button('SIDE',win.document);
  mode.click(); assert.ok(h.timers.size > 0);
  h.changeConsent(0);
  inactive(h); assert.equal(win.closed, true); assert.equal(frame.getAttribute('src'), null);
  assert.equal(h.video.nextSibling, next); assert.equal(h.video.getAttribute('style'), style); assert.equal(h.video.controls, false);
  assert.equal(h.video.pauseCount, 0); assert.deepEqual([...nativeButton.attributes], nativeAttributes); assert.equal(nativeRow.isConnected, true);
  assert.equal(h.writes.length, 0, 'revoking cancels pending preference persistence');
  entry.click(); chat.click(); mode.click(); emit(h.window, 'focus'); h.runTimers();
  assert.equal(h.pipRequests.length, 1); assert.equal(h.opened.length, 0); assert.equal(h.writes.length, 0); inactive(h);
  nativeButton.click(); assert.equal(nativeCalls, 1);
  h.changeConsent(1); assert.equal(ownEntries(h).length, 1); permanentExit(h);
});

for (const url of ['https://player.twitch.tv/?channel=example','https://www.twitch.tv/example/popout']) {
  test(`consent: native popout revoke removes frame and restores original layout on ${url}`, () => {
    const h = createHarness({locale:'en',url,setup({root}) {
      root.style.setProperty('--tcc-player-width','initial-width','important');
      root.style.setProperty('--tcc-player-height','initial-height');
      root.style.setProperty('overflow','visible','important');
    }});
    const frame = frames(h.document)[0]; const rootStyle = h.root.style;
    h.changeConsent(0); inactive(h);
    assert.equal(frame.isConnected, false); assert.equal(frame.getAttribute('src'), null);
    assert.equal(h.document.documentElement.hasAttribute('data-tcc-popout-active'), false);
    assert.equal(h.root.hasAttribute('data-tcc-player-root'), false);
    assert.equal(rootStyle.getPropertyValue('--tcc-player-width'), 'initial-width');
    assert.equal(rootStyle.getPropertyPriority('--tcc-player-width'), 'important');
    assert.equal(rootStyle.getPropertyValue('--tcc-player-height'), 'initial-height');
    assert.equal(rootStyle.getPropertyValue('overflow'), 'visible');
    assert.equal(rootStyle.getPropertyPriority('overflow'), 'important');
    assert.equal(h.video.pauseCount, 0); permanentExit(h);
  });
}

test('consent: a stale initial enabled read cannot undo a newer revoke', () => {
  const h = createHarness({locale:'en',consent:1,deferStorage:true});
  assert.equal(h.pendingStorageReads.length, 1); inactive(h);
  h.changeConsent(0); h.pendingStorageReads.shift()(); inactive(h);
  h.openGear(); inactive(h); assert.equal(h.writes.length, 0); permanentExit(h);
});

test('consent: a stale initial disabled read cannot undo a newer enable', () => {
  const h = createHarness({locale:'en',consent:false,deferStorage:true});
  h.openGear(); h.changeConsent(1); assert.equal(ownEntries(h).length, 1);
  h.pendingStorageReads.shift()(); assert.equal(ownEntries(h).length, 1); permanentExit(h);
});

test('consent: consent events do not discard still-valid saved preferences from a pending read', () => {
  for (const revokeFirst of [false,true]) {
    const h = createHarness({locale:'en',consent:revokeFirst ? 1 : false,deferStorage:true,url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1440,height:900}});
    h.changeConsent(revokeFirst ? 0 : 1);
    h.pendingStorageReads.shift()();
    if (revokeFirst) { inactive(h); h.changeConsent(1); }
    assert.equal(h.button('HIDE').getAttribute('aria-pressed'), 'true', 'saved mode survives the consent generation change');
    permanentExit(h);
    assert.deepEqual(h.writes.at(-1).tccPreferences, {mode:'hide',width:1440,height:900});
  }
});

test('consent: an older preference read never overwrites a newer explicit layout selection', async () => {
  const h = createHarness({locale:'en',consent:false,deferStorage:true,url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1440,height:900}});
  h.changeConsent(1); await h.click('SIDE'); h.runTimers(1000);
  assert.equal(h.writes.length, 0, 'never save defaults before preferences finish loading');
  h.pendingStorageReads.shift()(); h.runTimers(1000);
  assert.equal(h.button('SIDE').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(h.writes.at(-1).tccPreferences, {mode:'side',width:1440,height:900}); permanentExit(h);
});

test('consent: leaving before the preference read completes never overwrites old settings', async () => {
  const h = createHarness({locale:'en',consent:false,deferStorage:true,url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1440,height:900}});
  h.changeConsent(1); await h.click('SIDE'); h.runTimers(1000); assert.equal(h.writes.length, 0);
  permanentExit(h); h.pendingStorageReads.shift()(); h.runTimers();
  assert.equal(h.writes.length, 0); inactive(h);
});

test('consent: early PiP size changes merge without replacing the saved layout mode', async () => {
  const h = createHarness({locale:'en',consent:false,deferStorage:true,preferences:{mode:'hide',width:1440,height:900}});
  h.openGear(); h.changeConsent(1); await h.click(topLabel);
  const win = h.pipWindows[0]; win.innerWidth=1100; win.innerHeight=710; emit(win,'resize'); win.close();
  h.runTimers(1000); assert.equal(h.writes.length,0);
  h.pendingStorageReads.shift()(); h.runTimers(1000);
  assert.deepEqual(h.writes.at(-1).tccPreferences,{mode:'hide',width:1100,height:710}); permanentExit(h);
});

test('consent: a deferred preference read cannot recreate timers while in BFCache', async () => {
  const h = createHarness({locale:'en',consent:false,deferStorage:true,url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1440,height:900}});
  h.changeConsent(1); await h.click('SIDE'); emit(h.window,'pagehide',{persisted:true}); inactive(h);
  h.pendingStorageReads.shift()(); inactive(h); assert.equal(h.writes.length,0);
  emit(h.window,'pageshow',{persisted:true}); assert.equal(h.button('SIDE').getAttribute('aria-pressed'),'true');
  permanentExit(h); assert.deepEqual(h.writes.at(-1).tccPreferences,{mode:'side',width:1440,height:900});
});

test('consent: deferred initialization and passive events do not read the current URL before consent', () => {
  const h = createHarness({locale:'en',consent:false,deferStorage:true});
  let reads = 0;
  Object.defineProperty(h.context, 'location', {get() { reads++; return h.location; }});
  h.pendingStorageReads.shift()();
  emit(h.window, 'focus'); emit(h.document, 'loadedmetadata'); emit(h.window.navigation, 'navigatesuccess'); h.runTimers();
  assert.equal(reads, 0); inactive(h); permanentExit(h);
});

for (const reenable of [false,true]) {
  test(`consent: pending PiP result is discarded after revoke${reenable ? ' and re-enable' : ''}`, async () => {
    let resolve;
    const h = createHarness({locale:'en',pipRequest:win => new Promise(done => { resolve = () => done(win); })});
    h.openGear(); h.button(topLabel).click(); assert.equal(h.pipRequests.length, 1);
    h.changeConsent(0); inactive(h);
    if (reenable) h.changeConsent(1);
    resolve(); await flush();
    assert.equal(h.pipWindows[0].closed, true); assert.equal(h.video.parentNode, h.container);
    assert.equal(frames(h.pipWindows[0].document).length, 0); assert.equal(h.document.querySelector('#tcc-placeholder'), null);
    assert.equal(h.opened.length, 0); assert.equal(h.writes.length, 0); permanentExit(h);
  });
}

test('consent: unrelated or nonlocal storage changes cannot enable or revoke', () => {
  const h = createHarness({consent:false,locale:'en'}); h.openGear();
  for (const listener of h.storageListeners) {
    listener({tccConsentVersion:{newValue:1}}, 'sync');
    listener({tccPreferences:{newValue:{mode:'side'}}}, 'local');
  }
  inactive(h); h.changeConsent(1); assert.equal(ownEntries(h).length, 1);
  for (const listener of h.storageListeners) listener({tccConsentVersion:{newValue:0}}, 'sync');
  assert.equal(ownEntries(h).length, 1); permanentExit(h);
});

test('consent: unavailable storage and failed initial read leave the gate closed', () => {
  const h = createHarness({locale:'en',consent:1,deferStorage:true});
  h.context.chrome.runtime.lastError = {message:'Storage unavailable'};
  h.pendingStorageReads.shift()(); inactive(h); assert.equal(h.writes.length, 0); permanentExit(h);
});

test('consent: BFCache does not reactivate while suspended and honors intervening revocation', () => {
  const h = createHarness({locale:'en',url:'https://player.twitch.tv/?channel=example'});
  const first = frames(h.document)[0]; emit(h.window, 'pagehide', {persisted:true}); inactive(h);
  assert.equal(h.storageListeners.size, 1);
  h.changeConsent(0); h.changeConsent(1); inactive(h);
  emit(h.window, 'pageshow', {persisted:true}); assert.equal(frames(h.document).length, 1); assert.notEqual(frames(h.document)[0], first);
  emit(h.window, 'pagehide', {persisted:true}); h.changeConsent(0); emit(h.window, 'pageshow', {persisted:true}); inactive(h);
  permanentExit(h); assert.equal(h.storageListeners.size, 0);
});

test('consent: permanent pagehide removes storage listener and invalidates pending initial read', () => {
  const h = createHarness({locale:'en',consent:1,deferStorage:true});
  permanentExit(h); assert.equal(h.storageListeners.size, 0);
  h.changeConsent(1); h.pendingStorageReads.shift()(); emit(h.window, 'pageshow', {persisted:true}); h.openGear(); h.runTimers();
  inactive(h); assert.equal(h.writes.length, 0);
});

for (const action of ['revoke','permanent pagehide','BFCache']) {
  test(`consent: fallback navigation timer is cancelled on ${action}`, () => {
    const h = createHarness({locale:'en',setup({window}) { window.navigation = null; }});
    const link = h.document.createElement('a'); link.setAttribute('href','/another'); h.document.body.append(link);
    emit(link, 'click', {bubbles:true});
    assert.ok([...h.timers.values()].some(timer => timer.ms === 500));
    if (action === 'revoke') h.changeConsent(0); else emit(h.window, 'pagehide', {persisted:action === 'BFCache'});
    inactive(h); permanentExit(h);
  });
}

// Builds an actual-ID/element fixture from the packaged onboarding markup; no HTML parser dependency.
// These are the original 1.5.0 popup consent contracts, migrated to the full settings page.
function onboardingHarness({locale='en',stored,deferRead=false,deferWrite=false,readError=false,writeError=false,throwRead=false,throwWrite=false} = {}) {
  const document = new Document();
  const html = fs.readFileSync(path.join(extension, 'onboarding.html'), 'utf8');
  for (const [,tag,attributes] of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    if (!/\bid=|\bdata-i18n=/.test(attributes)) continue;
    const el = document.createElement(tag);
    for (const [,name,value] of attributes.matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)) el.setAttribute(name,value);
    if (/\bhidden\b/.test(attributes)) el.hidden = true;
    document.body.append(el);
  }
  const c = catalog(locale), writes = [], pendingReads = [], pendingWrites = [];
  let closed = 0, value = stored;
  const runtime = {getManifest:() => ({version:'1.5.1'})};
  const storageListeners = new Set();
  const window = new EventTarget();
  window.close = () => { closed++; };
  const invoke = (fn,error) => { if (error) runtime.lastError={message:'Synthetic storage failure'}; fn(); delete runtime.lastError; };
  const storage = {onChanged:{addListener:listener=>storageListeners.add(listener),removeListener:listener=>storageListeners.delete(listener)},local:{get(key,callback) {
    assert.equal(key,'tccConsentVersion'); if (throwRead) throw new Error('Storage context gone');
    const before = value; const run = () => invoke(() => callback(before === undefined ? {} : {tccConsentVersion:before}),readError);
    if (deferRead) pendingReads.push(run); else run();
  },set(update,callback) {
    if (throwWrite) throw new Error('Storage context gone');
    writes.push(JSON.parse(JSON.stringify(update)));
    const run = () => invoke(() => { if (!writeError) value = update.tccConsentVersion; callback(); },writeError);
    if (deferWrite) pendingWrites.push(run); else run();
  }}};
  const context = vm.createContext({document,window,chrome:{runtime,storage},TCCI18n:{
    message:key => c[key]?.message || '',
    applyDocument(doc) { doc.documentElement.lang=locale.replaceAll('_','-'); doc.documentElement.dir=locale==='ar'?'rtl':'ltr'; }
  }});
  vm.runInContext(fs.readFileSync(path.join(extension,'onboarding.js'),'utf8'), context);
  return {document,writes,pendingReads,pendingWrites,runtime,storageListeners,get value() { return value; },get closed() { return closed; },el:id=>document.querySelector(`#${id}`)};
}

for (const locale of locales) {
  test(`consent onboarding: ${locale} has disclosure, explicit opt-in, later, and revocation`, () => {
    const h = onboardingHarness({locale}); const c=catalog(locale);
    assert.equal(h.el('consent-prompt').hidden, false); assert.equal(h.el('consent-active').hidden, true);
    for (const key of ['consentHeading','consentQuestion','consentLocalUse','consentStored','consentAgreement','consentEnable','consentLater','consentEnabled','consentDisable','consentSaveError','consentDeferred']) assert.ok(c[key]?.message.trim(), `${locale}:${key}`);
    for (const node of h.document.querySelectorAll('[data-i18n]')) assert.equal(node.textContent, c[node.getAttribute('data-i18n')].message);
    assert.equal(h.document.documentElement.dir, locale==='ar'?'rtl':'ltr'); assert.equal(h.writes.length, 0);
    h.el('consent-later').click(); assert.equal(h.closed, 0); assert.equal(h.writes.length, 0); assert.equal(h.value, undefined);
    assert.equal(h.el('consent-prompt').hidden, false);
    assert.ok(h.el('consent-status').textContent.trim(), 'later explains the disabled state without closing');
    h.el('consent-enable').click(); assert.equal(h.value, 1, 'enable remains available after declining');
    const enabled = onboardingHarness({locale}); enabled.el('consent-enable').click();
    assert.deepEqual(enabled.writes, [{tccConsentVersion:1}]); assert.equal(enabled.value, 1);
    assert.equal(enabled.el('consent-prompt').hidden, true); assert.equal(enabled.el('consent-active').hidden, false);
    assert.equal(enabled.closed, 0, 'enabling leaves help visible and does not launch a player');
    enabled.el('consent-disable').click(); assert.deepEqual(enabled.writes, [{tccConsentVersion:1},{tccConsentVersion:0}]);
    assert.equal(enabled.el('consent-prompt').hidden, false); assert.equal(enabled.el('consent-active').hidden, true);
  });
}

test('consent onboarding: existing consent opens active status without another write', () => {
  const h=onboardingHarness({stored:1}); assert.equal(h.el('consent-prompt').hidden,true); assert.equal(h.el('consent-active').hidden,false); assert.equal(h.writes.length,0);
});

test('consent onboarding: pending writes disable repeated actions and stale initial read cannot replace new choice', () => {
  const h=onboardingHarness({deferRead:true,deferWrite:true});
  for(const id of ['consent-enable','consent-disable','consent-later']) assert.equal(h.el(id).disabled,true,'initial read locks consent actions');
  for(const listener of h.storageListeners) listener({tccConsentVersion:{newValue:0}},'local');
  h.el('consent-enable').click(); h.el('consent-enable').click(); h.el('consent-later').click();
  assert.equal(h.writes.length,1); assert.equal(h.closed,0);
  for(const id of ['consent-enable','consent-disable','consent-later']) assert.equal(h.el(id).disabled,true);
  h.pendingWrites.shift()(); h.pendingReads.shift()();
  assert.equal(h.el('consent-active').hidden,false); assert.equal(h.el('consent-prompt').hidden,true);
  for(const id of ['consent-enable','consent-disable','consent-later']) assert.equal(h.el(id).disabled,false);
});

for(const error of ['readError','writeError','throwRead','throwWrite']) {
  test(`consent onboarding: ${error} is disclosed without claiming activation`, () => {
    const h=onboardingHarness({[error]:true}); if(error==='writeError'||error==='throwWrite') h.el('consent-enable').click();
    assert.equal(h.el('consent-status').textContent,catalog('en').consentSaveError.message);
    assert.equal(h.el('consent-active').hidden,true); assert.equal(h.el('consent-prompt').hidden,false);
    assert.equal(h.value,undefined);
    for(const id of ['consent-enable','consent-disable','consent-later']) assert.notEqual(h.el(id).disabled,true);
  });
}
