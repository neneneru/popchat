'use strict';
// Observed Twitch pt-BR menu hierarchy, 2026-10-15. Deterministic fixtures
// exercise the adapter; they do not assert browser extension execution.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness,emit,flush}=require('./helpers/mock-browser.cjs');
const nativeLabel='Pop-out de reprodução';
const locales=['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const routes=[['live','https://www.twitch.tv/example','gearEntry'],['VOD','https://www.twitch.tv/videos/1234567890','vodPopupEntry'],['embedded VOD','https://player.twitch.tv/?video=v1234567890','vodOpenPage']];
const entry=h=>h.document.querySelector('[data-tcc-gear-entry]');
function fixture(locale,url){
  return createHarness({locale,url,setup({document,root,video}){
    document.documentElement.lang='pt-BR';root.id='root';video.currentTime=123.8;
    const replay=document.createElement('section');replay.className='video-chat';root.append(replay);
  }});
}
function openNative(h,nativeAction=()=>{}){
  const portal=h.document.createElement('div');h.document.body.append(portal);
  return h.openGear({label:nativeLabel,nativeAction,menuParent:portal});
}
function duplicateNative(h,menu){
  const row=h.document.createElement('div'),button=h.document.createElement('button'),flex=h.document.createElement('div'),text=h.document.createElement('div');
  button.setAttribute('role','menuitem');text.textContent=nativeLabel;flex.append(text);button.append(flex);row.append(button);menu.append(row);
}
for(const locale of locales)test(`observed pt-BR native menu serves ${locale} live and VOD entries without an action attribute`,async()=>{
  const messages=JSON.parse(fs.readFileSync(path.join(__dirname,'../extension/_locales',locale,'messages.json'),'utf8'));
  for(const [kind,url,key] of routes){
    const h=fixture(locale,url);let nativeCalls=0;const {menu,nativeRow,nativeButton}=openNative(h,()=>nativeCalls++);
    // Exact observed hierarchy: menu > div > button[role=menuitem] > div > leaf div.
    assert.equal(menu.tagName,'DIV');assert.equal(menu.getAttribute('data-a-target'),'player-settings-menu');assert.equal(h.root.contains(menu),false);
    assert.equal(nativeRow.tagName,'DIV');assert.equal(nativeRow.parentElement,menu);assert.deepEqual(nativeRow.children,[nativeButton]);
    assert.equal(nativeButton.getAttribute('role'),'menuitem');assert.equal(nativeButton.getAttribute('data-a-target'),null);assert.equal(nativeButton.children.length,1);
    const flex=nativeButton.children[0],leaf=flex.children[0];assert.equal(flex.tagName,'DIV');assert.equal(flex.children.length,1);assert.equal(leaf.tagName,'DIV');assert.equal(leaf.children.length,0);assert.equal(leaf.textContent,nativeLabel);
    const originalAttributes=[...nativeButton.attributes],button=entry(h);assert.ok(button,`${locale}: ${kind}`);assert.equal(nativeRow.nextSibling,button.parentElement);assert.equal(button.textContent,messages[key].message);assert.equal(button.getAttribute('aria-label'),messages[key].message);
    assert.equal(h.document.documentElement.lang,'pt-BR');nativeButton.click();assert.equal(nativeCalls,1);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);
    button.click();if(kind==='live')assert.equal(h.pipRequests.length,1,'PiP requested synchronously');else assert.equal(h.opened.length,1,'ordinary popup requested synchronously');await flush();
    assert.equal(nativeCalls,1);assert.deepEqual([...nativeButton.attributes],originalAttributes);assert.equal(nativeButton.textContent,nativeLabel);
    if(kind==='live'){assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);assert.equal(h.video.ownerDocument,h.pipWindows[0].document);h.pipWindows[0].close();assert.equal(h.video.parentNode,h.container);}
    else{assert.equal(h.pipRequests.length,0);assert.equal(h.opened[0][0],'https://www.twitch.tv/videos/1234567890?t=0h2m3s&tcc_vod=1');assert.equal(h.video.pauseCount,1);assert.equal(h.video.parentNode,h.container);}
    emit(h.window,'pagehide',{persisted:false});assert.equal(h.observers.some(observer=>observer.active),false);assert.equal(h.timers.size,0);
  }
});

test('pt-BR support preserves exact labels, unique anchors, and strict native structure for live and VOD',()=>{
  for(const [,url] of routes)for(const invalid of ['similar label','extra row child','nested wrapper','duplicate anchor','duplicate menu']){
    const h=fixture('pt_BR',url),{menu,nativeRow,nativeButton}=openNative(h),stale=entry(h);assert.ok(stale);
    if(invalid==='similar label')nativeButton.children[0].children[0].textContent=`${nativeLabel} extra`;
    if(invalid==='extra row child')nativeRow.append(h.document.createElement('span'));
    if(invalid==='nested wrapper'){const wrapper=h.document.createElement('div');nativeRow.remove();wrapper.append(nativeRow);menu.prepend(wrapper);}
    if(invalid==='duplicate anchor')duplicateNative(h,menu);
    if(invalid==='duplicate menu'){const other=h.document.createElement('div');other.setAttribute('data-a-target','player-settings-menu');h.document.body.append(other);}
    emit(stale,'click');assert.equal(h.opened.length,0);assert.equal(h.pipRequests.length,0);assert.equal(h.video.pauseCount,0);
    h.mutation([{type:'childList',target:menu,addedNodes:[],removedNodes:[]}]);h.runTimers(200);assert.equal(entry(h),null,invalid);emit(h.window,'pagehide',{persisted:false});
  }
});
