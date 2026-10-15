'use strict';
// Deterministic integration tests for the archive-specific native-replay path.
// These doubles do not validate live Twitch DOM, React ownership, replay timing,
// real seeking/playback, computed CSS, browser user activation, or PiP support.
// Lifecycle fixtures explicitly opt into the unshipped research PiP path;
// shipped-default gating has separate tests below.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHarness,emit,deepElements,flush}=require('./helpers/mock-browser.cjs');
const url='https://www.twitch.tv/videos/1234567890';
const count=(doc,tag)=>deepElements(doc.documentElement).filter(e=>e.tagName===tag.toUpperCase()).length;
const status=doc=>deepElements(doc.documentElement).filter(e=>e.getAttribute('role')==='status').map(e=>e.textContent).join(' ');
const label=(h,key)=>h.context.TCCI18n.message(key);
const navigate=(h,value)=>{h.location.href=value;emit(h.window.navigation,'navigatesuccess');h.runTimers(200);};
function fixture(options={}) {
  let replay=null,list=null,native=null;
  const setup=options.setup;
  const h=createHarness({vodPipResearch:true,...options,locale:'en',url:options.url||url,setup(parts){
    const {document,root,player,video}=parts;root.id='root';root.className='site-root';
    video.currentTime=3723.75;
    if(options.replay!==false){replay=document.createElement('section');replay.className='video-chat native-replay';if(options.list!==false){list=document.createElement('div');list.className='video-chat__message-list-wrapper';replay.append(list);}root.append(replay);}
    native=document.createElement('button');native.textContent='Native playback';player.append(native);
    setup?.({...parts,replay,list,native});
  }});
  return Object.assign(h,{replay,list,native});
}
function popupButton(h){if(!h.document.querySelector('[data-a-target="player-settings-menu"]'))h.openGear({label:'Popout Player'});return h.document.querySelector('[data-tcc-gear-entry]');}
async function clickPopup(h){const button=popupButton(h);assert.ok(button);button.click();await flush();}
async function open(h){h.context.vodResearch.openPip();await flush();return h.pipWindows.at(-1);}
function assertNoLiveFrame(h){assert.equal(count(h.document,'iframe'),0);for(const win of h.pipWindows)assert.equal(count(win.document,'iframe'),0);assert.equal(h.document.querySelector('#tcc-panel'),null);}
function assertRestored(h){assert.equal(h.root.parentNode,h.document.body);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.video.parentNode,h.container);assert.equal(h.replay.parentNode,h.root);assert.equal(h.document.querySelector('#tcc-vod-placeholder'),null);assert.equal(h.root.hasAttribute('data-tcc-vod-path'),false);assert.equal(h.player.hasAttribute('data-tcc-vod-player'),false);assert.equal(h.replay.hasAttribute('data-tcc-vod-replay'),false);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assertNoLiveFrame(h);}

test('VOD routing accepts official numeric archive routes and differentiates archive identity',()=>{
  const h=fixture({consent:false}),v=h.context.TCCVod;
  for(const value of [url,`${url}/`,`${url}?t=1h2m3s`,`${url}?tcc_vod=1`]){const route=v.parseLocation(value);assert.equal(route.kind,'vod');assert.equal(route.videoId,'1234567890');assert.equal(route.embedded,false);assert.equal(route.popout,value.includes('tcc_vod=1'));}
  for(const value of ['https://player.twitch.tv/?video=v1234567890','https://player.twitch.tv/?video=1234567890']){const route=v.parseLocation(value);assert.equal(route.videoId,'1234567890');assert.equal(route.embedded,true);assert.equal(route.popout,false);}
  assert.notEqual(v.identity(v.parseLocation(url)),v.identity(v.parseLocation('https://www.twitch.tv/videos/987654321')));
  assert.notEqual(v.identity(v.parseLocation(url)),v.identity(v.parseLocation(`${url}?tcc_vod=1`)));
  assert.notEqual(v.identity(v.parseLocation(url)),v.identity({channel:'example',popout:false}));
  assert.equal(v.identity(null),'');
});

test('VOD routing rejects invalid, non-Twitch, credentialed, and non-archive URLs',()=>{
  const v=fixture({consent:false}).context.TCCVod;
  for(const value of ['',null,'not a URL','http://www.twitch.tv/videos/123','https://twitch.tv/videos/123','https://www.twitch.tv.evil.test/videos/123','https://evil.test/videos/123','https://user:pass@www.twitch.tv/videos/123','https://www.twitch.tv:8443/videos/123','https://www.twitch.tv/videos/0','https://www.twitch.tv/videos/0123','https://www.twitch.tv/videos/-1','https://www.twitch.tv/videos/1.5','https://www.twitch.tv/videos/1e4','https://www.twitch.tv/videos/123abc','https://www.twitch.tv/videos/123/extra','https://www.twitch.tv/videos/123456789012345678901','https://www.twitch.tv/example','https://www.twitch.tv/directory','https://player.twitch.tv/?channel=example','https://player.twitch.tv/?channel=example&video=v123','https://player.twitch.tv/?video=v0','https://player.twitch.tv/?video=vabc'])assert.equal(v.parseLocation(value),null,String(value));
});

test('official VOD page URLs preserve numeric ID, floor playback position, and set the opt-in layout flag only when requested',()=>{
  const v=fixture({consent:false}).context.TCCVod;
  assert.equal(v.pageURL('123',3723.75,true),'https://www.twitch.tv/videos/123?t=1h2m3s&tcc_vod=1');
  assert.equal(v.pageURL('123',-15,false),'https://www.twitch.tv/videos/123?t=0h0m0s');
  for(const seconds of [undefined,NaN,Infinity,-Infinity])assert.equal(new URL(v.pageURL('123',seconds)).searchParams.get('t'),'0h0m0s');
  for(const id of ['0','0123','../123','1?x=1','abc','123456789012345678901'])assert.throws(()=>v.pageURL(id),/Invalid archive ID/);
});

test('archive popup entry uses the native gear menu without a floating launcher or PiP UI',()=>{
  const h=fixture();assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assert.equal(h.document.querySelector('[data-tcc-gear-entry]'),null);assert.ok(popupButton(h));assert.equal(h.button(label(h,'vodPipEntry')),undefined);assertNoLiveFrame(h);assert.equal(h.root.parentNode,h.document.body);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);
});

for(const value of [false,0,2,'1'])test(`archive consent ${JSON.stringify(value)} leaves page, controls, playback, and storage untouched`,()=>{
  const h=fixture({consent:value});assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assert.equal(h.root.hasAttribute('data-tcc-vod-path'),false);assert.equal(h.video.pauseCount,0);assert.equal(h.video.playCount,0);assert.equal(h.writes.length,0);assert.equal(h.observers.filter(o=>o.active).length,0);assertNoLiveFrame(h);
});

test('delayed consent read creates no VOD UI before consent is known',()=>{
  const h=fixture({deferStorage:true});assert.equal(h.document.querySelector('#tcc-vod-controls'),null);h.openGear();assert.equal(h.document.querySelector('[data-tcc-gear-entry]'),null);h.pendingStorageReads[0]();assert.ok(popupButton(h));assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assertNoLiveFrame(h);
});

test('popup opens the full official archive at current position and pauses the original after successful open',async()=>{
  const h=fixture({preferences:{mode:'side',width:1111,height:777}});let pausedAtOpen;
  const original=h.window.open.bind(h.window);h.window.open=(...args)=>{pausedAtOpen=h.video.pauseCount;return original(...args);};
  await clickPopup(h);assert.equal(pausedAtOpen,0);assert.equal(h.opened.length,1);assert.equal(h.opened[0][0],`${url}?t=1h2m3s&tcc_vod=1`);assert.equal(h.opened[0][1],'_blank');assert.match(h.opened[0][2],/width=1111,height=777/);assert.equal(h.video.pauseCount,1);assert.equal(h.video.playCount,0);assert.equal(h.pipRequests.length,0);assert.match(status(h.document),/original video is paused/);assertNoLiveFrame(h);
});

test('blocked popup does not pause, move, or attempt a PiP fallback',async()=>{
  const h=fixture({popupBlocked:true});await clickPopup(h);assert.equal(h.opened.length,1);assert.equal(h.video.pauseCount,0);assert.equal(h.video.playCount,0);assert.equal(h.root.parentNode,h.document.body);assert.equal(h.pipRequests.length,0);assert.ok(status(h.document));assertNoLiveFrame(h);
});

test('embedded VOD offers full archive navigation without replay adoption',async()=>{
  const h=fixture({url:'https://player.twitch.tv/?video=v1234567890'});assert.equal(popupButton(h).textContent,label(h,'vodOpenPage'));assert.equal(h.button(label(h,'vodPipEntry')),undefined);await h.click(label(h,'vodOpenPage'));assert.equal(h.opened[0][0],`${url}?t=1h2m3s&tcc_vod=1`);assert.equal(h.pipRequests.length,0);assertNoLiveFrame(h);
});

for(const missing of ['replay'])test(`missing native ${missing} does not request PiP or adopt the root`,async()=>{
  const h=fixture({[missing]:false});await open(h);assert.equal(h.pipRequests.length,0);assert.equal(h.root.parentNode,h.document.body);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.video.pauseCount,0);h.openGear();assert.match(status(h.document),/replay chat visible/);assertNoLiveFrame(h);
});

test('native unavailable replay state is preserved without substituting live chat or manufacturing messages',async()=>{
  const h=fixture({list:false,setup:({replay})=>{replay.textContent='Chat replay is unavailable for this archive';}});const text=h.replay.textContent;const win=await open(h);assert.equal(h.replay.ownerDocument,win.document);assert.equal(h.replay.textContent,text);assert.equal(h.replay.querySelector('.video-chat__message-list-wrapper'),null);assertNoLiveFrame(h);win.close();assertRestored(h);assert.equal(h.replay.textContent,text);
});

test('ambiguous, nested, or unrelated native replay candidates fail closed',async()=>{
  for(const setup of [({document,root,replay})=>root.append(Object.assign(document.createElement('div'),{className:replay.className})),({document,root})=>{const outer=document.createElement('div');document.body.append(outer);outer.append(root);},({player,replay})=>player.append(replay)]){
    const h=fixture({setup});await open(h);assert.equal(h.pipRequests.length,0);assert.equal(h.video.ownerDocument,h.document);assertNoLiveFrame(h);
  }
});

test('open Twitch settings and aria-hidden app prevent adoption without changing native controls',async()=>{
  const h=fixture();const {nativeButton}=h.openGear();await open(h);assert.equal(h.pipRequests.length,0);assert.equal(nativeButton.isConnected,true);h.closeGear();h.root.setAttribute('aria-hidden','true');await open(h);assert.equal(h.pipRequests.length,0);h.root.removeAttribute('aria-hidden');await open(h);assert.equal(h.pipRequests.length,1);
});

test('PiP moves the same app, player, video, replay, and native listeners together and restores exact sibling position',async()=>{
  let nativeClicks=0;const h=fixture();h.native.addEventListener('click',()=>nativeClicks++);const before=h.document.createElement('aside'),after=h.document.createElement('footer');h.document.body.insertBefore(before,h.root);h.root.after(after);const rootChildren=[...h.root.children];const playerChildren=[...h.player.children];
  h.context.vodResearch.openPip();assert.equal(h.pipRequests.length,1);assert.equal(h.video.ownerDocument,h.document);await flush();const child=h.pipWindows[0];
  assert.equal(h.root.parentNode,child.document.body);assert.equal(h.video.ownerDocument,child.document);assert.equal(h.replay.ownerDocument,child.document);assert.deepEqual(h.root.children,rootChildren);assert.deepEqual(h.player.children,playerChildren);assert.equal(h.video.controls,false);assert.equal(h.video.pauseCount,0);assert.equal(h.video.playCount,0);assert.equal(count(child.document,'video'),1);assert.equal(h.document.querySelector('#root'),null);assert.ok(h.document.querySelector('#tcc-vod-placeholder'));emit(h.native,'click');assert.equal(nativeClicks,1);assertNoLiveFrame(h);
  child.close();assertRestored(h);assert.equal(h.root.previousElementSibling,before);assert.equal(h.root.nextSibling,after);emit(h.native,'click');assert.equal(nativeClicks,2);child.close();emit(child,'pagehide');assertRestored(h);assert.equal(h.video.pauseCount,0);
});

test('PiP restoration preserves original and later site style/class changes while removing only extension layout state',async()=>{
  const h=fixture();h.root.style.setProperty('color','red','important');h.root.style.setProperty('--tcc-vod-pw','17px','important');h.player.style.setProperty('opacity','0.9');h.replay.setAttribute('data-site-state','loaded');const win=await open(h);
  h.root.classList.add('site-updated');h.root.style.setProperty('color','blue');h.player.style.setProperty('opacity','0.6');h.replay.classList.add('site-new-replay');win.close();assertRestored(h);assert.equal(h.root.className,'site-root site-updated');assert.equal(h.root.style.getPropertyValue('color'),'blue');assert.equal(h.player.style.getPropertyValue('opacity'),'0.6');assert.equal(h.replay.classList.contains('site-new-replay'),true);assert.equal(h.replay.getAttribute('data-site-state'),'loaded');assert.equal(h.root.style.getPropertyValue('--tcc-vod-pw'),'17px');assert.equal(h.root.style.getPropertyPriority('--tcc-vod-pw'),'important');for(const key of ['ph','cx','cy','cw','ch','visible'])assert.equal(h.root.style.getPropertyValue(`--tcc-vod-${key}`),'');
});

test('PiP copies stylesheet references and theme metadata without copying document scripts',async()=>{
  const h=fixture({setup:({document})=>{document.documentElement.className='theme-dark';document.documentElement.lang='ja';document.documentElement.dir='ltr';document.body.className='site-body';const style=document.createElement('style');style.textContent='.site-root{color:white}';const link=document.createElement('link');link.setAttribute('rel','stylesheet');link.setAttribute('href','https://static.twitchcdn.net/site.css');link.setAttribute('media','screen');const script=document.createElement('script');script.textContent='not copied';document.head.append(style,link,script);}});
  const win=await open(h);assert.equal(win.document.documentElement.className,'theme-dark');assert.equal(win.document.documentElement.lang,'ja');assert.equal(win.document.documentElement.dir,'ltr');assert.equal(win.document.body.className,'site-body');assert.ok([...win.document.querySelectorAll('style')].some(e=>e.textContent==='.site-root{color:white}'));assert.equal(win.document.querySelector('link[rel="stylesheet"]').getAttribute('href'),'https://static.twitchcdn.net/site.css');assert.equal(win.document.querySelector('link[rel="stylesheet"]').getAttribute('media'),'screen');assert.equal(count(win.document,'script'),0);assertNoLiveFrame(h);
});

test('mode controls reuse the same native replay and resize only extension variables',async()=>{
  const h=fixture();const win=await open(h);for(const [mode,width,height] of [['side',1000,700],['bottom',420,620],['hide',960,620]]){win.innerWidth=width;win.innerHeight=height;await h.click(mode.toUpperCase(),win.document);emit(win,'resize');assert.equal(h.root.parentNode,win.document.body);assert.equal(h.replay.parentNode,h.root);assert.equal(h.replay.ownerDocument,win.document);assert.equal(h.button(mode.toUpperCase(),win.document).getAttribute('aria-pressed'),'true');assert.equal(h.root.style.getPropertyValue('--tcc-vod-visible'),mode==='hide'?'hidden':'visible');assertNoLiveFrame(h);}win.close();h.runTimers(300);assert.deepEqual(Object.keys(h.writes.at(-1).tccPreferences).sort(),['height','mode','width']);
});

for(const exit of ['different VOD','unsupported route','live route','consent withdrawn','pagehide','BFCache','BFCache restored','VOD roundtrip','source detached','root replaced','replay replaced','URL changed before reconciliation'])test(`pending VOD PiP is invalidated by ${exit}`,async()=>{
  let resolve;const h=fixture({pipRequest:win=>new Promise(r=>{resolve=()=>r(win);})});await open(h);
  if(exit==='different VOD')navigate(h,'https://www.twitch.tv/videos/987654321');
  if(exit==='unsupported route')navigate(h,'https://www.twitch.tv/directory');
  if(exit==='live route')navigate(h,'https://www.twitch.tv/example');
  if(exit==='consent withdrawn')h.changeConsent(undefined);
  if(exit==='pagehide')emit(h.window,'pagehide',{persisted:false});
  if(exit==='BFCache')emit(h.window,'pagehide',{persisted:true});
  if(exit==='BFCache restored'){emit(h.window,'pagehide',{persisted:true});emit(h.window,'pageshow',{persisted:true});}
  if(exit==='VOD roundtrip'){navigate(h,'https://www.twitch.tv/videos/987654321');navigate(h,url);}
  if(exit==='source detached')h.video.remove();
  if(exit==='root replaced'){h.root.id='old-root';const replacement=h.document.createElement('div');replacement.id='root';h.document.body.append(replacement);}
  if(exit==='replay replaced'){h.replay.remove();const replacement=h.document.createElement('section');replacement.className='video-chat';const list=h.document.createElement('div');list.className='video-chat__message-list-wrapper';replacement.append(list);h.root.append(replacement);}
  if(exit==='URL changed before reconciliation')h.location.href='https://www.twitch.tv/videos/987654321';
  resolve();await flush();assert.equal(h.pipWindows[0].closed,true);assert.equal(h.root.ownerDocument,h.document);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.document.querySelector('#tcc-vod-placeholder'),null);assert.equal(h.opened.length,0);assertNoLiveFrame(h);
});

test('duplicate clicks during pending VOD PiP invoke requestWindow only once',async()=>{
  let resolve;const h=fixture({pipRequest:win=>new Promise(r=>{resolve=()=>r(win);})});h.context.vodResearch.openPip();h.context.vodResearch.openPip();assert.equal(h.pipRequests.length,1);resolve();await flush();assert.equal(h.root.ownerDocument,h.pipWindows[0].document);assertNoLiveFrame(h);
});

for(const exit of ['different VOD','unsupported route','consent withdrawn','pagehide','BFCache'])test(`active VOD PiP closes and restores on ${exit}`,async()=>{
  const h=fixture();const win=await open(h);
  if(exit==='different VOD')navigate(h,'https://www.twitch.tv/videos/987654321');
  else if(exit==='unsupported route')navigate(h,'https://www.twitch.tv/directory');
  else if(exit==='consent withdrawn')h.changeConsent(undefined);
  else emit(h.window,'pagehide',{persisted:exit==='BFCache'});
  assert.equal(win.closed,true);assertRestored(h);
  if(exit==='pagehide'||exit==='BFCache'||exit==='consent withdrawn')assert.equal(h.observers.filter(o=>o.active).length,0);
  if(exit==='BFCache'){emit(h.window,'pageshow',{persisted:true});await open(h);assert.equal(h.pipRequests.length,2);}
});

test('new source app root while PiP is active closes PiP and discards the stale root without duplicates',async()=>{
  const h=fixture();const win=await open(h);const root=h.document.createElement('div');root.id='root';const video=h.document.createElement('video');root.append(video);h.document.body.append(root);h.mutation([{type:'childList',target:h.document.body,addedNodes:[root],removedNodes:[]}]);assert.equal(win.closed,true);assert.equal(h.root.isConnected,false);assert.equal(h.video.paused,true);assert.equal(h.document.querySelector('#root'),root);assert.equal(h.document.querySelectorAll('#root').length,1);assert.equal(h.document.querySelector('#tcc-vod-placeholder'),null);assert.equal(count(h.document,'video'),1);
});

test('removed source placeholder prevents stale root restoration when PiP closes',async()=>{
  const h=fixture();const win=await open(h);h.document.querySelector('#tcc-vod-placeholder').remove();win.close();assert.equal(h.root.isConnected,false);assert.equal(h.video.paused,true);assert.equal(h.document.querySelector('#root'),null);assert.equal(h.document.querySelector('#tcc-vod-placeholder'),null);assertNoLiveFrame(h);
});

for(const removed of ['video','replay','player'])test(`removed active ${removed} closes VOD PiP through its bounded observer`,async()=>{
  const h=fixture();const win=await open(h);const node=h[removed],parent=node.parentNode;node.remove();h.mutation([{type:'childList',target:parent,addedNodes:[],removedNodes:[node]}]);assert.equal(win.closed,true);assert.equal(h.root.parentNode,h.document.body);assert.equal(h.document.querySelector('#tcc-vod-placeholder'),null);assertNoLiveFrame(h);
});

test('rejected VOD PiP leaves native state intact and allows a later retry',async()=>{
  let attempts=0;const h=fixture({pipRequest:win=>++attempts===1?Promise.reject(new Error('NotAllowedError')):Promise.resolve(win)});await open(h);assertRestored(h);assert.equal(h.video.pauseCount,0);h.openGear();assert.ok(status(h.document));h.closeGear();await open(h);assert.equal(h.pipRequests.length,2);assert.equal(h.root.ownerDocument,h.pipWindows[1].document);assertNoLiveFrame(h);
});

for(const step of ['adoption','after adoption'])test(`VOD PiP ${step} failure restores source and closes the incomplete window`,async()=>{
  const h=fixture({pipRequest:win=>{if(step==='adoption'){win.document.body.append=()=>{throw new Error('Synthetic adoption failure');};}else{const add=win.addEventListener.bind(win);win.addEventListener=(name,...args)=>{if(name==='resize')throw new Error('Synthetic setup failure');return add(name,...args);};}return Promise.resolve(win);}});await open(h);assert.equal(h.pipWindows[0].closed,true);assertRestored(h);assert.equal(h.video.pauseCount,0);assert.equal(h.video.playCount,0);assertNoLiveFrame(h);
});

test('full archive popup lays out its existing document and native nodes without creating a live iframe',async()=>{
  const h=fixture({url:`${url}?t=1h2m3s&tcc_vod=1`});assert.equal(h.root.parentNode,h.document.body);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.replay.ownerDocument,h.document);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.ok(h.button('SIDE'));assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);await h.click('BOTTOM');assert.equal(h.replay.parentNode,h.root);assertNoLiveFrame(h);
});

test('popup layout remains active after focus, metadata, and scheduled reconciliation',()=>{
  const h=fixture({url:`${url}?tcc_vod=1`}),host=h.document.querySelector('#tcc-vod-controls');emit(h.window,'focus');emit(h.document,'loadedmetadata');h.runTimers(200);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.equal(h.document.querySelector('#tcc-vod-controls'),host);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);assert.ok(h.button('SIDE'));assert.equal(h.button('アーカイブに戻る'),undefined);assertNoLiveFrame(h);
});

test('popup without native replay stays usable without applying archive layout',()=>{
  const h=fixture({url:`${url}?tcc_vod=1`,replay:false});assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assert.equal(h.root.hasAttribute('data-tcc-vod-path'),false);assert.equal(h.video.ownerDocument,h.document);assert.ok(popupButton(h));assert.match(status(h.document),/not available/);assertNoLiveFrame(h);
});

test('stale VOD gear entry and research commands cannot open windows after route change or consent withdrawal',async()=>{
  for(const exit of ['route','consent']){const h=fixture();const popup=popupButton(h),pip=h.context.vodResearch.openPip;if(exit==='route')h.location.href='https://www.twitch.tv/videos/987654321';else h.changeConsent(undefined);emit(popup,'click');pip();await flush();assert.equal(h.opened.length,0);assert.equal(h.pipRequests.length,0);assert.equal(h.video.pauseCount,0);}
});

test('repeated VOD PiP cycles leave one root, no live frame, and bounded lifecycle observation',async()=>{
  const h=fixture();for(let i=0;i<4;i++){const win=await open(h);const active=h.observers.filter(o=>o.active);for(const observer of active)for(const {settings}of observer.observations)assert.notEqual(settings.subtree,true);win.close();h.runTimers(300);assertRestored(h);assert.equal(h.document.querySelectorAll('#root').length,1);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,0);}emit(h.window,'pagehide',{persisted:false});h.runTimers();assert.equal(h.observers.filter(o=>o.active).length,0);assert.equal(h.timers.size,0);assert.equal(h.document.querySelector('#tcc-vod-controls'),null);
});

test('non-VOD routes retain existing live behavior and unsupported routes remain untouched',()=>{
  const live=createHarness({locale:'en'});assert.equal(live.document.querySelector('#tcc-vod-controls'),null);live.openGear({label:'Popout Player'});assert.ok(live.document.querySelector('[data-tcc-gear-entry]'));assert.equal(count(live.document,'iframe'),0);
  const native=createHarness({locale:'en',url:'https://player.twitch.tv/?channel=example'});assert.equal(native.document.querySelector('#tcc-vod-controls'),null);assert.equal(count(native.document,'iframe'),1);
  const unsupported=fixture({url:'https://www.twitch.tv/directory'});assert.equal(unsupported.document.querySelector('#tcc-vod-controls'),null);assert.equal(unsupported.root.hasAttribute('data-tcc-vod-path'),false);assertNoLiveFrame(unsupported);
});

test('popup native replay arriving after the player is discovered and mounted without another user gesture',()=>{
  const h=fixture({url:`${url}?tcc_vod=1`,replay:false});assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assert.equal(h.observers.some(o=>o.active&&o.observations.some(({settings})=>settings.subtree)),true);const replay=h.document.createElement('section');replay.className='video-chat';const list=h.document.createElement('div');list.className='video-chat__message-list-wrapper';replay.append(list);h.root.append(replay);h.mutation([{type:'childList',target:h.root,addedNodes:[replay],removedNodes:[]}]);h.runTimers(200);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);assert.equal(h.observers.some(o=>o.active&&o.observations.some(({settings})=>settings.subtree)),false);assert.equal(replay.hasAttribute('data-tcc-vod-replay'),true);assertNoLiveFrame(h);
});

test('missing popup replay discovery stops after its bounded window and consent/pagehide cancel it',()=>{
  for(const stop of ['timeout','consent','pagehide']){const h=fixture({url:`${url}?tcc_vod=1`,replay:false});assert.equal(h.observers.some(o=>o.active),true);if(stop==='timeout')h.runTimers(10000);else if(stop==='consent')h.changeConsent(undefined);else emit(h.window,'pagehide',{persisted:false});assert.equal(h.observers.some(o=>o.active&&o.observations.some(({settings})=>settings.subtree)),false);if(stop!=='timeout')assert.equal(h.observers.some(o=>o.active),false);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assertNoLiveFrame(h);}
});

test('VOD popup and PiP use the chosen largest source instead of the first incidental video',async()=>{
  for(const action of ['popup','pip']){let incidental;const h=fixture({setup:({document,root})=>{incidental=document.createElement('video');incidental.currentTime=8;incidental.rect={width:100,height:80,top:0,left:0,right:100,bottom:80};root.prepend(incidental);}});assert.equal(h.document.querySelector('video'),incidental);if(action==='popup'){await clickPopup(h);assert.equal(h.opened[0][0],`${url}?t=1h2m3s&tcc_vod=1`);assert.equal(h.video.pauseCount,1);assert.equal(incidental.pauseCount,0);}else{await open(h);assert.equal(h.pipRequests.length,1);assert.equal(h.video.ownerDocument,h.pipWindows[0].document);assert.equal(h.player.hasAttribute('data-tcc-vod-player'),true);}assertNoLiveFrame(h);}
});

test('detaching an active popup app root removes extension layout instead of retaining stale native references',()=>{
  const h=fixture({url:`${url}?tcc_vod=1`});h.root.remove();h.mutation([{type:'childList',target:h.document.body,addedNodes:[],removedNodes:[h.root]}]);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assert.equal(h.root.hasAttribute('data-tcc-vod-path'),false);assert.equal(h.document.querySelector('#tcc-vod-placeholder'),null);assertNoLiveFrame(h);
});

for(const exit of ['consent withdrawn','unsupported route','pagehide','BFCache'])test(`native full-page VOD layout is removed on ${exit}`,()=>{
  const h=fixture({url:`${url}?tcc_vod=1`});assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);if(exit==='consent withdrawn')h.changeConsent(undefined);else if(exit==='unsupported route')navigate(h,'https://www.twitch.tv/directory');else emit(h.window,'pagehide',{persisted:exit==='BFCache'});assertRestored(h);assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assert.equal(h.observers.some(o=>o.active),false);assert.equal(h.video.pauseCount,0);if(exit==='BFCache'){emit(h.window,'pageshow',{persisted:true});assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);}
});

test('full-page VOD flag cannot bypass missing or pending consent',()=>{
  for(const options of [{consent:false},{deferStorage:true}]){const h=fixture({url:`${url}?tcc_vod=1`,...options});assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);assertNoLiveFrame(h);}
});

test('SPA transitions between live native popout, VOD, and live route clean their separate panels and frames',()=>{
  const h=fixture({url:'https://www.twitch.tv/example/popout'});const frame=deepElements(h.document.documentElement).find(e=>e.tagName==='IFRAME');assert.ok(frame);navigate(h,url);assert.equal(frame.isConnected,false);assert.equal(frame.getAttribute('src'),null);assert.ok(popupButton(h));assertNoLiveFrame(h);navigate(h,'https://www.twitch.tv/example');assert.equal(h.document.querySelector('#tcc-vod-controls'),null);h.openGear({label:'Popout Player'});assert.ok(h.document.querySelector('[data-tcc-gear-entry]'));assert.equal(count(h.document,'iframe'),0);navigate(h,`${url}?tcc_vod=1`);assert.equal(h.document.querySelector('[data-tcc-gear-entry]'),null);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assertNoLiveFrame(h);
});

test('popup archive navigation replaces the toolbar and invalidates its stale mode actions',()=>{
  const h=fixture({url:`${url}?tcc_vod=1`}),host=h.document.querySelector('#tcc-vod-controls'),stale=h.button('HIDE');navigate(h,'https://www.twitch.tv/videos/987654321?tcc_vod=1');assert.equal(host.isConnected,false);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);emit(stale,'click');assert.equal(h.button('AUTO').getAttribute('aria-pressed'),'true');assert.equal(h.button('HIDE').getAttribute('aria-pressed'),'false');assertNoLiveFrame(h);
});

test('shipped VOD default exposes ordinary full-page popup only, with no experimental PiP entry or request',async()=>{
  const h=fixture({vodPipResearch:false});assert.ok(popupButton(h));assert.equal(h.button(label(h,'vodPipEntry')),undefined);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,0);h.openGear({label:'Popout Player'});assert.equal(h.document.querySelectorAll('[data-tcc-gear-entry]').length,1);assert.equal(h.pipRequests.length,0);assert.equal(h.root.parentNode,h.document.body);await clickPopup(h);assert.equal(h.opened.length,1);assert.equal(h.opened[0][0],`${url}?t=1h2m3s&tcc_vod=1`);assert.equal(h.pipRequests.length,0);assert.equal(h.root.parentNode,h.document.body);assertNoLiveFrame(h);
});

test('shipped popup lifecycle cleanup and BFCache restoration never reveal VOD PiP or return controls',()=>{
  const h=fixture({vodPipResearch:false,url:`${url}?tcc_vod=1`});assert.ok(h.button('AUTO'));assert.equal(h.button('アーカイブに戻る'),undefined);emit(h.window,'pagehide',{persisted:true});assertRestored(h);assert.equal(h.document.querySelector('#tcc-vod-controls'),null);emit(h.window,'pageshow',{persisted:true});assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);assert.ok(h.button('AUTO'));assert.equal(h.button(label(h,'vodPipEntry')),undefined);assert.equal(h.pipRequests.length,0);
});

test('same-route source replacement before popup click fails closed without opening or pausing either video',async()=>{
  const h=fixture({vodPipResearch:false});const popup=popupButton(h);h.video.remove();const replacement=h.document.createElement('video');replacement.currentTime=55;h.container.append(replacement);emit(popup,'click');await flush();assert.equal(h.opened.length,0);assert.equal(h.pipRequests.length,0);assert.equal(h.video.pauseCount,0);assert.equal(replacement.pauseCount,0);assert.equal(replacement.ownerDocument,h.document);assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assertNoLiveFrame(h);
});

test('active same-document popup remounts when the existing video moves into a new native player wrapper',()=>{
  const h=fixture({vodPipResearch:false,url:`${url}?tcc_vod=1`});const oldPlayer=h.player;assert.equal(oldPlayer.hasAttribute('data-tcc-vod-player'),true);const replacement=h.document.createElement('div');replacement.className='video-player';replacement.setAttribute('data-a-target','video-player');h.root.append(replacement);replacement.append(h.video);assert.equal(oldPlayer.isConnected,true);assert.equal(oldPlayer.contains(h.video),false);
  h.mutation([{type:'childList',target:h.container,addedNodes:[],removedNodes:[h.video]},{type:'childList',target:replacement,addedNodes:[h.video],removedNodes:[]}]);assert.equal(oldPlayer.hasAttribute('data-tcc-vod-player'),false);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);h.runTimers(200);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.equal(replacement.hasAttribute('data-tcc-vod-player'),true);assert.equal(oldPlayer.hasAttribute('data-tcc-vod-player'),false);assert.equal(h.document.querySelectorAll('[data-tcc-vod-player]').length,1);assert.equal(h.video.parentNode,replacement);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.video.isConnected,true);assert.equal(h.video.pauseCount,0);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);assertNoLiveFrame(h);
});


test('native replay reparenting rebuilds its marked ancestor path instead of hiding a new wrapper',()=>{
  const h=fixture({vodPipResearch:false,url:`${url}?tcc_vod=1`});const wrapper=h.document.createElement('div');h.root.append(wrapper);wrapper.append(h.replay);h.mutation([{type:'childList',target:h.root,addedNodes:[wrapper],removedNodes:[h.replay]}]);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);h.runTimers(200);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);assert.equal(wrapper.hasAttribute('data-tcc-vod-path'),true);assert.equal(h.replay.hasAttribute('data-tcc-vod-replay'),true);assert.equal(h.video.pauseCount,0);assertNoLiveFrame(h);
});


test('healthy native popup keeps status empty through resize and reconciliation',()=>{
  const h=fixture({vodPipResearch:false,url:`${url}?tcc_vod=1`});assert.equal(status(h.document),'');emit(h.window,'resize');emit(h.window,'focus');h.runTimers(200);assert.ok(h.replay.isConnected);assert.equal(status(h.document),'');assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),true);
});

test('popup action rejects a still-connected old source when the current primary video changed before reconciliation',async()=>{
  const h=fixture({vodPipResearch:false});h.video.rect={width:1,height:1};const replacement=h.document.createElement('video');replacement.rect={width:1200,height:700};replacement.currentTime=42;h.container.append(replacement);await clickPopup(h);assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);assert.equal(replacement.pauseCount,0);h.runTimers(200);await clickPopup(h);assert.equal(h.opened[0][0],`${url}?t=0h0m42s&tcc_vod=1`);assert.equal(replacement.pauseCount,1);assert.equal(h.video.pauseCount,0);
});
