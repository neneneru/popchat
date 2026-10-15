'use strict';
// Production-default integration coverage. No research hook, browser extension
// loading, real Twitch DOM rendering, or browser activation is asserted here.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness,emit,flush,Document}=require('./helpers/mock-browser.cjs');
const URL='https://www.twitch.tv/videos/1234567890';
const ENTRY='[data-tcc-gear-entry]',ROW='[data-tcc-gear-row]';
const locales=['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
function fixture(options={}){
  const setup=options.setup;
  return createHarness({...options,url:options.url||URL,setup(parts){
    const {document,root,video}=parts;root.id='root';video.currentTime=123.8;
    const replay=document.createElement('section');replay.className='video-chat';root.append(replay);
    setup?.({...parts,replay});
  }});
}
const entry=h=>h.document.querySelector(ENTRY);
const label=(h,key='vodPopupEntry')=>h.context.TCCI18n.message(key);
const navigate=(h,url)=>{h.location.href=url;emit(h.window.navigation,'navigatesuccess');h.runTimers(200);};
const noFloating=h=>assert.equal(h.document.querySelector('#tcc-vod-controls'),null);
const noPip=h=>{assert.equal(h.pipRequests.length,0);assert.equal(h.button(label(h,'vodPipEntry')),undefined);};

for(const locale of locales)test(`VOD gear entry has the existing ${locale} localization and direction`,()=>{
  const h=fixture({locale});h.openGear();const button=entry(h);assert.ok(button);assert.equal(button.textContent,label(h));assert.equal(button.getAttribute('aria-label'),label(h));assert.equal(button.lang,h.context.TCCI18n.language);assert.equal(button.dir,locale==='ar'?'rtl':'ltr');assert.equal(button.getAttribute('role'),'menuitem');if(locale==='ja')assert.equal(button.textContent,'ポップアウト（チャットリプレイ付き）');noFloating(h);noPip(h);
});

for(const api of [undefined,null,{}, {requestWindow:true}])test(`VOD popup gear entry does not require Document PiP: ${JSON.stringify(api)}`,()=>{
  const h=fixture({pip:false,setup:({window})=>{window.documentPictureInPicture=api;}});h.openGear();assert.ok(entry(h));entry(h).click();assert.equal(h.opened.length,1);assert.equal(h.opened[0][0],`${URL}?t=0h2m3s&tcc_vod=1`);assert.equal(h.video.pauseCount,1);noPip(h);noFloating(h);
});

test('VOD gear action opens synchronously in its click and never invokes or modifies native popout',()=>{
  let nativeCalls=0;const h=fixture();const {menu,nativeRow,nativeButton}=h.openGear({nativeAction:()=>nativeCalls++});const nativeMarkup=[nativeRow.className,nativeButton.className,nativeButton.textContent,nativeButton.getAttribute('role')];const button=entry(h);assert.equal(nativeRow.nextSibling,button.parentNode);assert.equal(button.parentNode.parentNode,menu);assert.equal(button.getAttribute('data-a-target'),null);
  let openedInClick=false,inClick=true;const original=h.window.open.bind(h.window);h.window.open=(...args)=>{openedInClick=inClick;assert.equal(h.video.pauseCount,0);return original(...args);};button.click();inClick=false;
  assert.equal(openedInClick,true);assert.equal(h.opened.length,1);assert.equal(nativeCalls,0);assert.deepEqual([nativeRow.className,nativeButton.className,nativeButton.textContent,nativeButton.getAttribute('role')],nativeMarkup);nativeButton.click();assert.equal(nativeCalls,1);assert.equal(h.opened.length,1);noFloating(h);noPip(h);
});

test('VOD entry works in a body portal outside the Twitch app and recovers after menu replacement',()=>{
  const h=fixture();const portal=h.document.createElement('div');h.document.body.append(portal);const first=h.openGear({menuParent:portal});assert.equal(h.root.contains(first.menu),false);const stale=entry(h);assert.ok(stale);h.closeGear();assert.equal(entry(h),null);const second=h.openGear({menuParent:portal});assert.notEqual(entry(h),stale);assert.equal(entry(h).parentNode.parentNode,second.menu);emit(stale,'click');assert.equal(h.opened.length,0);entry(h).click();assert.equal(h.opened.length,1);assert.equal(h.document.querySelectorAll(ROW).length,1);noPip(h);
});

for(const unsupported of ['unknown label','unknown structure','hidden menu','ambiguous menu'])test(`VOD gear ${unsupported} fails closed without a floating fallback`,()=>{
  const h=fixture();const {menu,nativeButton}=h.openGear({label:unsupported==='unknown label'?'Unverified popout label':'ポップアウト'});const stale=entry(h);
  if(unsupported==='unknown structure'){const icon=h.document.createElement('span');nativeButton.prepend(icon);}
  if(unsupported==='hidden menu')menu.hidden=true;
  if(unsupported==='ambiguous menu'){const another=h.document.createElement('div');another.setAttribute('data-a-target','player-settings-menu');h.document.body.append(another);}
  h.mutation([{type:'childList',target:menu,addedNodes:[],removedNodes:[]}]);h.runTimers(200);assert.equal(entry(h),null);if(stale)emit(stale,'click');assert.equal(h.opened.length,0);noPip(h);noFloating(h);
});

test('VOD menu repeated open, close, focus and re-render leave exactly one current entry',()=>{
  const h=fixture();for(let i=0;i<8;i++){h.openGear();emit(h.window,'focus');h.runTimers(200);assert.equal(h.document.querySelectorAll(ENTRY).length,1);assert.equal(h.document.querySelectorAll(ROW).length,1);h.closeGear();assert.equal(entry(h),null);noFloating(h);}assert.equal(h.opened.length,0);noPip(h);
});

for(const exit of ['route changed before reconciliation','different VOD','live','unsupported','consent','pagehide','BFCache'])test(`VOD gear stale entry is inert after ${exit}`,async()=>{
  const h=fixture();h.openGear();const stale=entry(h);
  if(exit==='route changed before reconciliation')h.location.href='https://www.twitch.tv/videos/987654321';
  else if(exit==='different VOD')navigate(h,'https://www.twitch.tv/videos/987654321');
  else if(exit==='live')navigate(h,'https://www.twitch.tv/example');
  else if(exit==='unsupported')navigate(h,'https://www.twitch.tv/directory');
  else if(exit==='consent')h.changeConsent(undefined);
  else emit(h.window,'pagehide',{persisted:exit==='BFCache'});
  emit(stale,'click');await flush();assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);noPip(h);noFloating(h);
  if(['consent','pagehide','BFCache'].includes(exit)){assert.equal(entry(h),null);assert.equal(h.observers.filter(o=>o.active).length,0);}
});

test('VOD gear BFCache restoration and consent re-enable recreate one current, usable entry',()=>{
  const h=fixture();h.openGear();const old=entry(h);emit(h.window,'pagehide',{persisted:true});emit(h.window,'pageshow',{persisted:true});assert.ok(entry(h));assert.notEqual(entry(h),old);h.changeConsent(undefined);assert.equal(entry(h),null);h.changeConsent(1);assert.equal(h.document.querySelectorAll(ENTRY).length,1);entry(h).click();assert.equal(h.opened.length,1);noPip(h);noFloating(h);
});

test('VOD gear is absent until consent and a connected player have both arrived',()=>{
  const h=fixture({video:false,consent:false});h.openGear();assert.equal(entry(h),null);h.changeConsent(1);assert.equal(entry(h),null);h.container.prepend(h.video);emit(h.document,'loadedmetadata');h.runTimers(200);assert.equal(h.document.querySelectorAll(ENTRY).length,1);noPip(h);noFloating(h);
});

for(const change of ['detached','adopted elsewhere','new primary still connected'])test(`VOD gear rejects a ${change} source, then binds the replacement`,()=>{
  const h=fixture();h.openGear();const stale=entry(h);if(change==='detached')h.video.remove();else if(change==='adopted elsewhere')new Document().body.append(h.video);else h.video.rect={width:1,height:1};
  const replacement=h.document.createElement('video');replacement.currentTime=42;replacement.rect={width:1200,height:700};h.container.append(replacement);emit(stale,'click');assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);assert.equal(replacement.pauseCount,0);
  emit(h.document,'loadedmetadata');h.runTimers(200);assert.ok(entry(h));assert.notEqual(entry(h),stale);emit(stale,'click');assert.equal(h.opened.length,0);entry(h).click();assert.equal(h.opened[0][0],`${URL}?t=0h0m42s&tcc_vod=1`);assert.equal(replacement.pauseCount,1);noFloating(h);noPip(h);
});

test('VOD popup failure keeps source playback and can retry through the same menu entry',()=>{
  const h=fixture();h.openGear();const button=entry(h),original=h.window.open.bind(h.window);let calls=0;h.window.open=(...args)=>++calls===1?null:original(...args);button.click();assert.equal(h.video.pauseCount,0);assert.equal(h.document.querySelector('[data-tcc-gear-status]').textContent,label(h,'vodErrorPopupBlocked'));button.click();assert.equal(h.video.pauseCount,1);assert.equal(h.opened.length,1);noPip(h);noFloating(h);
});

test('VOD discovery is bounded and pagehide releases all observers and timers',()=>{
  const h=fixture();assert.ok(h.observers.some(o=>o.active&&o.observations.some(({settings})=>settings.subtree)));h.runTimers(10000);assert.equal(h.observers.some(o=>o.active&&o.observations.some(({settings})=>settings.subtree)),false);h.openGear();assert.equal(h.document.querySelectorAll(ENTRY).length,1);emit(h.window,'pagehide',{persisted:false});h.runTimers();assert.equal(h.observers.filter(o=>o.active).length,0);assert.equal(h.timers.size,0);noFloating(h);
});

test('VOD to embedded VOD to live SPA transitions replace labels and actions without duplicates',()=>{
  const h=fixture();h.openGear();assert.equal(entry(h).textContent,label(h));navigate(h,'https://player.twitch.tv/?video=v1234567890');assert.equal(entry(h).textContent,label(h,'vodOpenPage'));assert.equal(h.document.querySelectorAll(ENTRY).length,1);navigate(h,'https://www.twitch.tv/example');assert.equal(entry(h).textContent,label(h,'gearEntry'));assert.equal(h.document.querySelectorAll(ENTRY).length,1);navigate(h,URL);assert.equal(entry(h).textContent,label(h));entry(h).click();assert.equal(h.opened.length,1);noPip(h);noFloating(h);
});

test('shipped manifest identifies 1.6.0 and source exposes no VOD PiP command or launch bar',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../extension/manifest.json'),'utf8'));assert.equal(manifest.version,'1.6.0');assert.equal(manifest.version_name,'1.6.0');const source=fs.readFileSync(path.join(__dirname,'../extension/vod.js'),'utf8');assert.match(source,/allowExperimentalPip=false/);assert.match(source,/return Object\.freeze\(\{reconcile,stop,resize\}\)/);assert.doesNotMatch(source,/vodPipEntry|left:12px|bottom:12px|launchControls/);
});
