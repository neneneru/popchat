'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHarness,emit,deepElements,flush}=require('./helpers/mock-browser.cjs');
const topLabel='ポップアウト（最前面）';
const count=(doc,tag)=>deepElements(doc.documentElement).filter(e=>e.tagName===tag.toUpperCase()).length;
const statuses=doc=>deepElements(doc.documentElement).filter(e=>e.getAttribute('role')==='status').map(e=>e.textContent).join(' ');
const navigate=(h,url)=>{h.location.href=url;emit(h.window.navigation,'navigatesuccess');h.runTimers(200);};
async function open(h){h.openGear();await h.click(topLabel);return h.pipWindows.at(-1);}
function assertNoIndependentUI(h){for(const id of ['tcc-launcher','tcc-source-notice','tcc-native-restore','tcc-pip-choice'])assert.equal(h.document.querySelector(`#${id}`),null);}

test('normal route has no extension UI or chat iframe until the actual gear menu opens',()=>{
  const h=createHarness();assertNoIndependentUI(h);assert.equal(h.button(topLabel),undefined);assert.equal(count(h.document,'iframe'),0);assert.equal(count(h.document,'button'),1);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);
  emit(h.window,'focus');h.runTimers(200);assertNoIndependentUI(h);assert.equal(h.button(topLabel),undefined);
  h.openGear();assert.ok(h.button(topLabel));assert.equal(count(h.document,'iframe'),0);
});

test('PiP moves the original video exactly once and OS close restores style, controls and sibling order',async()=>{
  const h=createHarness();const next=h.document.createElement('span');h.container.append(next);h.video.setAttribute('style','object-fit: cover; opacity: 0.9 !important;');const style=h.video.getAttribute('style');h.video.controls=false;
  const win=await open(h);assert.equal(h.video.ownerDocument,win.document);assert.equal(count(win.document,'video'),1);assert.equal(count(h.document,'video'),0);assert.equal(h.video.controls,true);assert.ok(h.document.querySelector('#tcc-placeholder'));assertNoIndependentUI(h);
  win.close();assert.equal(h.video.parentNode,h.container);assert.equal(h.video.nextSibling,next);assert.equal(h.video.getAttribute('style'),style);assert.equal(h.video.controls,false);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assert.equal(count(win.document,'iframe'),0);
  h.runTimers(300);assert.deepEqual(Object.keys(h.writes.at(-1).tccPreferences).sort(),['height','mode','width']);
});

test('repeated open and OS close have one video/frame and bounded active observers',async()=>{
  const h=createHarness();let maxSteady=0;
  for(let i=0;i<5;i++){
    const win=await open(h);assert.equal(h.pipRequests.length,i+1);assert.equal(count(win.document,'iframe'),1);win.close();h.runTimers(300);assert.equal(count(h.document,'video'),1);assert.equal(count(win.document,'iframe'),0);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assertNoIndependentUI(h);assert.equal(h.document.querySelectorAll('[data-tcc-gear-row]').length,1);maxSteady=Math.max(maxSteady,h.observers.filter(o=>o.active).length);
  }
  assert.ok(maxSteady<=2,`Unexpected steady observer count ${maxSteady}`);emit(h.window,'pagehide',{persisted:false});assert.equal(h.observers.filter(o=>o.active).length,0);
});

for(const where of ['same container','sibling wrapper']){
  test(`player/ad replacement in ${where} closes PiP and discards the stale source`,async()=>{
    const h=createHarness();const win=await open(h);const replacement=h.document.createElement('video');let added=replacement;
    if(where==='same container')h.container.append(replacement);else{const sibling=h.document.createElement('div');sibling.append(replacement);h.player.append(sibling);added=sibling;}
    h.mutation([{type:'childList',target:h.player,addedNodes:[added],removedNodes:[]}]);assert.equal(win.closed,true);assert.equal(h.video.isConnected,false);assert.equal(h.video.paused,true);assert.equal(h.player.querySelectorAll('video').length,1);assert.equal(h.player.querySelector('video'),replacement);assert.equal(h.document.querySelector('#tcc-placeholder'),null);
    h.runTimers(200);h.openGear();await h.click(topLabel);assert.equal(replacement.ownerDocument,h.pipWindows.at(-1).document);
  });
}

for(const exit of ['different channel','unsupported route','same-channel native popout','pagehide','BFCache pagehide','BFCache restored before resolve','channel roundtrip','source detached','URL before reconciliation']){
  test(`pending PiP request is discarded after ${exit}`,async()=>{
    let resolve;const h=createHarness({pipRequest:win=>new Promise(r=>{resolve=()=>r(win);})});await open(h);
    if(exit==='different channel')navigate(h,'https://www.twitch.tv/other');
    if(exit==='unsupported route')navigate(h,'https://www.twitch.tv/directory');
    if(exit==='same-channel native popout')navigate(h,'https://www.twitch.tv/example/popout');
    if(exit==='pagehide')emit(h.window,'pagehide',{persisted:false});
    if(exit==='BFCache pagehide')emit(h.window,'pagehide',{persisted:true});
    if(exit==='BFCache restored before resolve'){emit(h.window,'pagehide',{persisted:true});emit(h.window,'pageshow',{persisted:true});}
    if(exit==='channel roundtrip'){navigate(h,'https://www.twitch.tv/other');navigate(h,'https://www.twitch.tv/example');}
    if(exit==='source detached')h.video.remove();
    if(exit==='URL before reconciliation')h.location.href='https://www.twitch.tv/other';
    resolve();await flush();assert.equal(h.pipWindows[0].closed,true);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assert.equal(count(h.document,'iframe'),exit==='same-channel native popout'?1:0);assert.equal(h.opened.length,0);assertNoIndependentUI(h);
  });
}

test('rapid direct clicks while requestWindow is pending request only one window',async()=>{
  let resolve;const h=createHarness({pipRequest:win=>new Promise(r=>{resolve=()=>r(win);})});h.openGear();const button=h.button(topLabel);emit(button,'click');emit(button,'click');assert.equal(h.pipRequests.length,1);assert.equal(h.video.parentNode,h.container);resolve();await flush();assert.equal(h.video.ownerDocument,h.pipWindows[0].document);
});

test('rejected Document PiP preserves playback and reports within the native gear menu; retry works',async()=>{
  let attempts=0;const h=createHarness({pipRequest:win=>++attempts===1?Promise.reject(new Error('NotAllowedError')):Promise.resolve(win)});h.openGear();await h.click(topLabel);assert.equal(h.video.parentNode,h.container);assert.equal(h.video.pauseCount,0);assert.equal(h.video.playCount,0);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assert.match(statuses(h.document),/もう一度/);assertNoIndependentUI(h);assert.equal(h.opened.length,0);await h.click(topLabel);assert.equal(h.pipRequests.length,2);assert.equal(h.video.ownerDocument,h.pipWindows[1].document);
});

for(const exit of ['channel navigation','unsupported route','pagehide','BFCache']){
  test(`active PiP closes and cleans frame/source state on ${exit}`,async()=>{
    const h=createHarness();const win=await open(h);
    if(exit==='channel navigation')navigate(h,'https://www.twitch.tv/other');
    else if(exit==='unsupported route')navigate(h,'https://www.twitch.tv/directory');
    else emit(h.window,'pagehide',{persisted:exit==='BFCache'});
    assert.equal(win.closed,true);assert.equal(count(win.document,'iframe'),0);assert.equal(h.video.parentNode,h.container);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assertNoIndependentUI(h);
    if(exit==='pagehide'||exit==='BFCache')assert.equal(h.observers.filter(o=>o.active).length,0);
    if(exit==='unsupported route')assert.equal(h.button(topLabel),undefined);
    if(exit==='BFCache'){emit(h.window,'pageshow',{persisted:true});await open(h);assert.equal(h.pipRequests.length,2);}
  });
}

test('detached original player never receives a duplicate restored video',async()=>{
  const h=createHarness();const win=await open(h);h.root.remove();win.close();assert.equal(h.video.isConnected,false);assert.equal(h.video.paused,true);assert.equal(h.document.querySelector('#tcc-placeholder'),null);emit(h.window,'pagehide',{persisted:false});assert.equal(h.observers.filter(o=>o.active).length,0);
});

test('PiP dimensions are captured and normalized on OS close',async()=>{
  const h=createHarness();const win=await open(h);win.innerWidth=1033;win.innerHeight=719;emit(win,'resize');win.close();h.runTimers(300);assert.equal(h.writes.at(-1).tccPreferences.width,1033);assert.equal(h.writes.at(-1).tccPreferences.height,719);
});

test('initial discovery stops after timeout and loadedmetadata can retry',()=>{
  const h=createHarness({video:false});assert.equal(h.observers.filter(o=>o.active).length,1);h.runTimers(10000);assert.equal(h.observers.filter(o=>o.active).length,0);h.container.append(h.video);emit(h.document,'loadedmetadata');h.runTimers(200);h.openGear();assert.ok(h.button(topLabel));
});

test('late metadata, menu opens and focus after full disposal never resurrect UI',()=>{
  const h=createHarness();emit(h.window,'pagehide',{persisted:false});emit(h.document,'loadedmetadata');emit(h.window,'focus');h.openGear();h.runTimers();assert.equal(h.button(topLabel),undefined);assert.equal(h.document.querySelector('#tcc-panel'),null);assert.equal(h.observers.filter(o=>o.active).length,0);assertNoIndependentUI(h);
});

test('CSP failure reports official chat fallback and removed PiP listeners remain inactive',async()=>{
  const h=createHarness();const win=await open(h);emit(win.document,'securitypolicyviolation',{violatedDirective:'frame-src',blockedURI:'https://www.twitch.tv/embed/example/chat'});const notice=deepElements(win.document.documentElement).find(e=>e.getAttribute('role')==='status');assert.match(notice.textContent,/別窓/);win.close();notice.textContent='after close';emit(win.document,'securitypolicyviolation',{violatedDirective:'frame-src',blockedURI:'https://www.twitch.tv/embed/example/chat'});assert.equal(notice.textContent,'after close');
});


test('panel creation failure closes the granted PiP window and retains the source for retry',async()=>{
  let attempts=0;
  const h=createHarness({pipRequest:win=>{
    if(++attempts===1){const create=win.document.createElement.bind(win.document);win.document.createElement=tag=>{if(tag==='iframe')throw new Error('Synthetic iframe creation failure');return create(tag);};}
    return Promise.resolve(win);
  }});
  h.openGear();await h.click(topLabel);assert.equal(h.pipWindows[0].closed,true);assert.equal(h.video.parentNode,h.container);assert.equal(h.video.controls,false);assert.equal(h.video.getAttribute('style'),null);assert.equal(h.video.pauseCount,0);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assert.match(statuses(h.document),/もう一度/);await h.click(topLabel);assert.equal(h.pipRequests.length,2);assert.equal(h.video.ownerDocument,h.pipWindows[1].document);
});

test('failure after the video move restores the exact source and closes the incomplete PiP',async()=>{
  const h=createHarness({pipRequest:win=>{const add=win.addEventListener.bind(win);win.addEventListener=(name,callback,options)=>{if(name==='resize')throw new Error('Synthetic setup failure after video move');add(name,callback,options);};return Promise.resolve(win);}});
  h.video.setAttribute('style','opacity: 0.7 !important;');const before=h.video.getAttribute('style');h.video.controls=false;
  h.openGear();await h.click(topLabel);assert.equal(h.pipWindows[0].closed,true);assert.equal(h.video.parentNode,h.container);assert.equal(h.video.controls,false);assert.equal(h.video.getAttribute('style'),before);assert.equal(h.video.pauseCount,0);assert.equal(h.document.querySelector('#tcc-placeholder'),null);assert.equal(count(h.pipWindows[0].document,'iframe'),0);assert.match(statuses(h.document),/もう一度/);assert.equal(h.opened.length,0);
});
