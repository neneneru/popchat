'use strict';
// Runtime integration of actual inspected menu hierarchy. No live-browser claims.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../extension/core.js');
const {createHarness,emit,deepElements}=require('./helpers/mock-browser.cjs');
const topLabel='ポップアウト（最前面）';
const all=(doc,p)=>deepElements(doc.documentElement).filter(p);
const part=(doc,name)=>all(doc,e=>e.className.split(' ').includes(name))[0];
const stylesheet=doc=>all(doc,e=>e.tagName==='STYLE')[0].textContent;

for(const label of ['ポップアウト','Popout Player']){
  test(`native ${label} row remains untouched and custom sibling opens PiP directly once`,async()=>{
    let nativeClicks=0;const h=createHarness();const {menu,nativeRow,nativeButton}=h.openGear({label,nativeAction:()=>nativeClicks++});const attributes=[...nativeButton.attributes];const nativeClass=nativeButton.className;const nativeChildren=[...nativeButton.children];const custom=h.button(topLabel),row=custom.parentElement;
    assert.equal(row.parentElement,menu);assert.equal(nativeRow.nextSibling,row);assert.equal(custom.getAttribute('role'),'menuitem');assert.equal(custom.getAttribute('aria-label'),topLabel);assert.equal(custom.className,nativeClass);assert.equal(custom.textContent,topLabel);assert.equal(menu.querySelectorAll('[data-tcc-gear-entry]').length,1);assert.deepEqual([...nativeButton.attributes],attributes);assert.deepEqual(nativeButton.children,nativeChildren);
    // Synchronous count proves requestWindow is called in the click callback,
    // before the handler returns or any awaited promise resolves.
    emit(custom,'click');assert.equal(h.pipRequests.length,1);assert.equal(h.opened.length,0);assert.equal(nativeClicks,0);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(h.video.ownerDocument,h.pipWindows[0].document);assert.equal(nativeButton.textContent,label);assert.deepEqual([...nativeButton.attributes],attributes);
    emit(nativeButton,'click');assert.equal(nativeClicks,1);assert.equal(h.pipRequests.length,1);
  });
}

test('unknown or absent native popout row creates no independent fallback control',()=>{
  const h=createHarness();h.openGear({label:'Open something else'});assert.equal(h.button(topLabel),undefined);assert.equal(h.document.querySelector('#tcc-launcher'),null);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);
});

test('repeated menu mounting, mutations and focus never duplicate the enhancement',()=>{
  const h=createHarness();for(let i=0;i<5;i++){const {menu}=h.openGear();h.mutation([{type:'childList',target:menu,addedNodes:[],removedNodes:[]}]);emit(h.window,'focus');h.runTimers(200);assert.equal(h.document.querySelectorAll('[data-tcc-gear-entry]').length,1);h.closeGear();assert.equal(h.document.querySelectorAll('[data-tcc-gear-entry]').length,0);}emit(h.window,'pagehide',{persisted:false});assert.equal(h.observers.filter(o=>o.active).length,0);assert.equal(h.timers.size,0);
});

test('idle observation never leaves a document-wide subtree observer indefinitely',()=>{
  const h=createHarness();h.runTimers(2500);assert.equal(h.observers.some(o=>o.active&&o.observations.some(({target,settings})=>(target===h.document.body||target===h.document.documentElement)&&settings.subtree)),false);
  const {menu}=h.openGear();h.runTimers(2500);for(const observer of h.observers.filter(o=>o.active))for(const {target,settings}of observer.observations)if(settings.subtree)assert.equal(target,menu);
  h.closeGear();h.runTimers(2500);assert.equal(h.observers.some(o=>o.active&&o.observations.some(({target,settings})=>(target===h.document.body||target===h.document.documentElement)&&settings.subtree)),false);
});

test('gear entry disappears after video loss and comes back only after source returns',()=>{
  const h=createHarness();h.openGear();assert.ok(h.button(topLabel));h.video.remove();emit(h.window,'focus');h.runTimers(200);assert.equal(h.button(topLabel),undefined);h.container.append(h.video);emit(h.document,'loadedmetadata');h.runTimers(200);assert.ok(h.button(topLabel));
});

test('36px native header aligns layout arithmetic for every mode and target viewport',async()=>{
  assert.equal(Core.HEADER_HEIGHT,36);const h=createHarness({url:'https://player.twitch.tv/?channel=example'});const css=stylesheet(h.document);const nativeCSS=fs.readFileSync(path.join(__dirname,'../extension/content.css'),'utf8');assert.match(css,/\.bar\{[^}]*height:36px;/);assert.match(css,/grid-template-rows:36px minmax\(0,1fr\)/);assert.match(nativeCSS,/top:\s*36px\s*!important/);assert.match(nativeCSS,/height: var\(--tcc-player-height, calc\(100vh - 36px\)\)/);
  for(const width of [1200,960,700,420,360,320]){h.window.innerWidth=width;h.window.innerHeight=620;emit(h.window,'resize');for(const mode of Core.MODES){await h.click(mode.toUpperCase());const layout=Core.layout(mode,width,620);assert.equal(part(h.document,'area').className,`area ${layout.mode}`);assert.equal(part(h.document,'area').style.getPropertyValue('--chat-size'),`${layout.chat}px`);assert.equal(h.root.style.getPropertyValue('--tcc-player-width'),layout.mode==='side'?`max(0px, calc(100vw - ${layout.chat}px))`:'100vw');assert.equal(h.root.style.getPropertyValue('--tcc-player-height'),layout.mode==='bottom'?`max(0px, calc(100vh - ${Core.HEADER_HEIGHT+layout.chat}px))`:`calc(100vh - ${Core.HEADER_HEIGHT}px)`);}}
});

test('24px button and 36px header stylesheet bounds leave symmetric 5px inner space',()=>{
  const h=createHarness({url:'https://player.twitch.tv/?channel=example'});const css=stylesheet(h.document);
  assert.match(css,/\.bar\{[^}]*padding:5px 14px/);assert.match(css,/\.modes\{[^}]*padding:0;[^}]*border:0/);assert.match(css,/button\{height:24px;min-height:24px;/);assert.match(css,/\.mode\{[^}]*padding:2px 12px;[^}]*line-height:20px/);assert.match(css,/\*\{box-sizing:border-box\}/);assert.match(css,/\[hidden\]\{display:none!important\}/);assert.match(css,/@media\(max-width:500px\)\{\.bar\{[^}]*padding:5px 8px/);assert.doesNotMatch(css,/\.modes\{[^}]*border:1px/);
  // Source arithmetic only; actual rendered control bounds require a browser.
  assert.ok(24+2*5+1<=Core.HEADER_HEIGHT);
});

test('stored HIDE preference does not skip official iframe creation or remove layout controls',()=>{
  const h=createHarness({url:'https://player.twitch.tv/?channel=example',preferences:{mode:'hide',width:1000,height:700}});assert.equal(part(h.document,'chat').hidden,true);assert.equal(all(h.document,e=>e.tagName==='IFRAME').length,1);assert.equal(h.button('HIDE').getAttribute('aria-pressed'),'true');assert.equal(h.button('SIDE').isConnected,true);
});

test('native BFCache cleanup destroys the old frame and reinitializes exactly one panel',()=>{
  const h=createHarness({url:'https://player.twitch.tv/?channel=example'});const frame=all(h.document,e=>e.tagName==='IFRAME')[0];emit(h.window,'pagehide',{persisted:true});assert.equal(frame.isConnected,false);assert.equal(frame.getAttribute('src'),null);assert.equal(h.document.querySelector('#tcc-panel'),null);emit(h.window,'pageshow',{persisted:true});assert.equal(h.document.querySelectorAll('#tcc-panel').length,1);assert.equal(all(h.document,e=>e.tagName==='IFRAME').length,1);assert.notEqual(all(h.document,e=>e.tagName==='IFRAME')[0],frame);assert.equal(h.button(topLabel),undefined);
});

test('stale gear item cannot open a PiP after URL changes before SPA reconciliation',()=>{
  for(const url of ['https://www.twitch.tv/other','https://www.twitch.tv/example/popout','https://www.twitch.tv/directory']){
    const h=createHarness();h.openGear();const entry=h.button(topLabel);h.location.href=url;emit(entry,'click');assert.equal(h.pipRequests.length,0);assert.equal(h.video.parentNode,h.container);assert.equal(h.opened.length,0);
  }
});

test('same-channel normal/native SPA transitions remove and restore only their appropriate UI',()=>{
  const h=createHarness();h.openGear();assert.ok(h.button(topLabel));
  h.location.href='https://www.twitch.tv/example/popout';emit(h.window.navigation,'navigatesuccess');h.runTimers(200);assert.equal(h.button(topLabel),undefined);assert.equal(h.document.querySelectorAll('#tcc-panel').length,1);const frame=all(h.document,e=>e.tagName==='IFRAME')[0];
  h.location.href='https://www.twitch.tv/example';emit(h.window.navigation,'navigatesuccess');h.runTimers(200);assert.equal(h.document.querySelector('#tcc-panel'),null);assert.equal(frame.isConnected,false);assert.equal(frame.getAttribute('src'),null);assert.equal(h.document.querySelectorAll('[data-tcc-gear-entry]').length,1);assert.equal(h.video.parentNode,h.container);assert.equal(h.opened.length,0);assert.equal(h.pipRequests.length,0);
});
