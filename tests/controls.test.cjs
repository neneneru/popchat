'use strict';
// Deterministic DOM/API and stylesheet-source regressions, not browser rendering.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHarness,emit,keydown,focusedElement,deepElements}=require('./helpers/mock-browser.cjs');
const Core=require('../extension/core.js');
const nativeURLs=['https://player.twitch.tv/?channel=example','https://www.twitch.tv/example/popout'];
const modes=['AUTO','SIDE','BOTTOM','HIDE'];
const all=(doc,p)=>deepElements(doc.documentElement).filter(p);
const part=(doc,name)=>all(doc,e=>e.className.split(' ').includes(name))[0];
const frames=doc=>all(doc,e=>e.tagName==='IFRAME');
const pressed=doc=>all(doc,e=>e.className==='mode'&&e.getAttribute('aria-pressed')==='true').map(e=>e.textContent);
async function surface(url){const h=createHarness({url});if(!url){h.openGear();await h.click('ポップアウト（最前面）');}const win=url?h.window:h.pipWindows[0];return {h,win,doc:win.document};}

for(const url of [undefined,...nativeURLs]){
  const name=url||'Document PiP';
  test(`header has exactly the six requested buttons, in order: ${name}`,async()=>{
    const {h,doc}=await surface(url);const bar=part(doc,'bar');
    assert.deepEqual(deepElements(bar).filter(e=>e.tagName==='BUTTON').map(e=>e.textContent),[...modes,'再読込','別窓']);
    assert.equal(part(doc,'title').textContent,'example');
    assert.equal(bar.children[0],part(doc,'title'));
    assert.equal(part(doc,'modes').getAttribute('role'),'group');
    assert.equal(part(doc,'modes').getAttribute('aria-label'),'チャットの配置');
    assert.deepEqual(pressed(doc),['AUTO']);
    for(const label of modes){const b=h.button(label,doc);assert.equal(b.type,'button');assert.match(b.getAttribute('aria-label'),new RegExp(`^${label}: .+`));assert.ok(b.title);}
    assert.equal(all(doc,e=>e.tagName==='SELECT').length,0);
    for(const text of ['最前面','戻す','⋯','チャットを隠す','標準PiP試験を準備','Twitch本来の表示に一時的に戻す'])assert.equal(h.button(text,doc),undefined);
    assert.equal(part(doc,'menu'),undefined);assert.equal(part(doc,'pip-choice'),undefined);
  });
  test(`mode changes save only preferences; AUTO reflows and retains pressed state: ${name}`,async()=>{
    const {h,win,doc}=await surface(url);
    for(const label of ['SIDE','BOTTOM','HIDE','AUTO']){await h.click(label,doc);assert.deepEqual(pressed(doc),[label]);h.runTimers(300);const saved=h.writes.at(-1).tccPreferences;assert.equal(saved.mode,label.toLowerCase());assert.deepEqual(Object.keys(saved).sort(),['height','mode','width']);}
    win.innerWidth=500;win.innerHeight=800;emit(win,'resize');assert.equal(part(doc,'area').className,'area bottom');assert.deepEqual(pressed(doc),['AUTO']);
    win.innerWidth=1100;win.innerHeight=650;emit(win,'resize');assert.equal(part(doc,'area').className,'area side');assert.deepEqual(pressed(doc),['AUTO']);
  });
  test(`HIDE preserves live iframe identity, source URL and playback: ${name}`,async()=>{
    const {h,doc}=await surface(url);const frame=frames(doc)[0],src=frame.src,loads=frame.srcAssignments.length,parent=h.video.parentNode;
    for(let i=0;i<3;i++){
      await h.click('HIDE',doc);assert.equal(part(doc,'chat').hidden,true);assert.equal(frame.isConnected,true);assert.equal(frames(doc).length,1);assert.equal(frames(doc)[0],frame);assert.equal(frame.src,src);assert.equal(frame.srcAssignments.length,loads);assert.equal(h.video.parentNode,parent);assert.equal(h.video.pauseCount,0);assert.equal(h.video.playCount,0);
      if(url){assert.equal(h.root.style.getPropertyValue('--tcc-player-width'),'100vw');assert.equal(h.root.style.getPropertyValue('--tcc-player-height'),`calc(100vh - ${Core.HEADER_HEIGHT}px)`);}
      await h.click('SIDE',doc);assert.equal(part(doc,'chat').hidden,false);assert.equal(frames(doc)[0],frame);assert.equal(frame.srcAssignments.length,loads);
    }
    assert.equal(h.opened.length,0);
  });
  test(`direct reload is explicit, reuses iframe, and leaves video untouched: ${name}`,async()=>{
    const {h,doc}=await surface(url);const frame=frames(doc)[0],src=frame.src,loads=frame.srcAssignments.length,parent=h.video.parentNode;
    await h.click('HIDE',doc);await h.click('再読込',doc);
    assert.equal(frames(doc)[0],frame);assert.equal(frame.src,src);assert.equal(frame.srcAssignments.length,loads+1);assert.equal(part(doc,'chat').hidden,true);assert.equal(h.video.parentNode,parent);assert.equal(h.video.pauseCount,0);assert.equal(h.opened.length,0);
  });
  test(`direct chat window uses correct browsing context without replacing playback: ${name}`,async()=>{
    const {h,win,doc}=await surface(url);const frame=frames(doc)[0],loads=frame.srcAssignments.length,parent=h.video.parentNode;
    assert.equal(h.opened.length,0);await h.click('別窓',doc);
    assert.equal(h.opened.length,1);assert.equal(h.openContexts[0],win);const opened=new URL(h.opened[0][0]);assert.equal(opened.origin,'https://www.twitch.tv');assert.equal(opened.pathname,'/popout/example/chat');assert.equal(h.video.parentNode,parent);assert.equal(h.video.pauseCount,0);assert.equal(win.closed,false);assert.equal(frames(doc)[0],frame);assert.equal(frame.srcAssignments.length,loads);
  });
}

test('mode arrows wrap and Home/End move focus without selecting or saving',async()=>{
  const {h,doc}=await surface();const before=h.writes.length;
  for(const [from,key,to]of [['AUTO','ArrowRight','SIDE'],['SIDE','ArrowLeft','AUTO'],['AUTO','ArrowLeft','HIDE'],['HIDE','ArrowRight','AUTO'],['SIDE','End','HIDE'],['BOTTOM','Home','AUTO']]){
    h.button(from,doc).focus();assert.equal(keydown(h.button(from,doc),key).defaultPrevented,true);assert.equal(focusedElement(doc),h.button(to,doc));assert.deepEqual(pressed(doc),['AUTO']);
  }
  assert.equal(keydown(h.button('SIDE',doc),'Tab').defaultPrevented,false);assert.equal(h.writes.length,before);await h.click('SIDE',doc);assert.deepEqual(pressed(doc),['SIDE']);
});

test('native root transparency and pointer pass-through preserve original video controls',()=>{
  const h=createHarness({url:nativeURLs[0]});const host=h.document.querySelector('#tcc-panel');assert.equal(host.style.pointerEvents,'none');assert.equal(part(h.document,'panel').style.background,'transparent');assert.equal(part(h.document,'video').style.background,'transparent');assert.equal(part(h.document,'video').style.pointerEvents,'');assert.equal(part(h.document,'bar').style.pointerEvents,'auto');assert.equal(part(h.document,'chat').style.pointerEvents,'auto');assert.equal(h.video.parentNode,h.container);
});

test('blocked chat window shows useful status while HIDE preserves selected mode',async()=>{
  const {h,doc}=await surface(undefined);h.window.open=()=>null;h.pipWindows[0].open=()=>null;
  await h.click('HIDE',doc);await h.click('別窓',doc);
  const statuses=all(doc,e=>e.getAttribute('role')==='status');assert.match(statuses.map(e=>e.textContent).join(' '),/ポップアップ/);assert.deepEqual(pressed(doc),['HIDE']);assert.equal(h.video.ownerDocument,doc);
});
