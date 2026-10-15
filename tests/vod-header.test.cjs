'use strict';
// DOM/API doubles and source-CSS comparisons verify shared implementation, not
// computed rendering, native browser keyboard activation, or Twitch replay sync.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness,emit,keydown,focusedElement,deepElements}=require('./helpers/mock-browser.cjs');
const Core=require('../extension/core.js');
const url='https://www.twitch.tv/videos/1234567890?tcc_vod=1';
const modes=['AUTO','SIDE','BOTTOM','HIDE'];
const locales=['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const elements=doc=>deepElements(doc.documentElement);
const part=(doc,name)=>elements(doc).find(el=>el.className.split(' ').includes(name));
const style=doc=>elements(doc).find(el=>el.tagName==='STYLE'&&el.textContent.includes(':host{')).textContent;
const pressed=doc=>elements(doc).filter(el=>el.className==='mode'&&el.getAttribute('aria-pressed')==='true').map(el=>el.textContent);
function fixture(options={}){
  let replay;return Object.assign(createHarness({...options,url,setup({document,root,video}){
    root.id='root';video.currentTime=90;replay=document.createElement('section');replay.className='video-chat';root.append(replay);
  }}),{replay});
}

for(const locale of locales)test(`VOD uses the live header CSS and four localized mode controls: ${locale}`,async()=>{
  const h=fixture({locale}),live=createHarness({locale,url:'https://player.twitch.tv/?channel=example'}),doc=h.document;
  const messages=JSON.parse(fs.readFileSync(path.join(__dirname,'../extension/_locales',locale,'messages.json'),'utf8'));
  const host=doc.querySelector('#tcc-vod-controls'),bar=part(doc,'bar'),group=part(doc,'modes'),title=part(doc,'title');
  assert.equal(bar.tagName,'HEADER');assert.equal(host.lang,h.context.TCCI18n.language);assert.equal(host.dir,h.context.TCCI18n.direction);
  assert.equal(host.style.height,`${Core.HEADER_HEIGHT}px`);assert.equal(host.style.pointerEvents,'none');assert.equal(bar.style.pointerEvents,'auto');
  assert.equal(style(doc),style(live.document),'VOD and live render the exact same stylesheet');
  assert.deepEqual(deepElements(bar).filter(el=>el.tagName==='BUTTON').map(el=>el.textContent),modes);
  assert.equal(title.textContent,messages.vodTitle.message);assert.equal(title.title,title.textContent);assert.equal(bar.firstChild,title);
  assert.equal(title.className,part(live.document,'title').className);assert.equal(group.getAttribute('role'),'group');assert.equal(group.getAttribute('aria-label'),part(live.document,'modes').getAttribute('aria-label'));assert.equal(group.getAttribute('aria-label'),messages.layoutGroup.message);
  for(const mode of modes){const button=h.button(mode),reference=live.button(mode);assert.equal(button.type,'button');assert.equal(button.className,reference.className);assert.equal(button.title,reference.title);const key={AUTO:'modeAutoTitle',SIDE:'modeSideTitle',BOTTOM:'modeBottomTitle',HIDE:'modeHideTitle'}[mode];assert.equal(button.title,messages[key].message);assert.equal(button.getAttribute('aria-label'),`${mode}: ${messages[key].message}`);assert.equal(button.getAttribute('aria-label'),reference.getAttribute('aria-label'));assert.equal(button.getAttribute('aria-pressed'),reference.getAttribute('aria-pressed'));}
  assert.deepEqual(pressed(doc),['AUTO']);assert.equal(elements(doc).filter(el=>el.tagName==='IFRAME').length,0);assert.equal(elements(doc).find(el=>el.getAttribute('role')==='status').textContent,'');
  assert.equal(h.opened.length,0);assert.equal(h.pipRequests.length,0);assert.equal(h.video.pauseCount,0);
  await h.click('BOTTOM');assert.deepEqual(pressed(doc),['BOTTOM']);assert.equal(h.video.parentNode,h.container);assert.equal(h.replay.parentNode,h.root);
});

for(const locale of ['en','ja','ar'])test(`VOD mode keyboard navigation matches live without selecting or saving: ${locale}`,async()=>{
  const h=fixture({locale}),before=h.writes.length;
  for(const [from,key,to] of [['AUTO','ArrowRight','SIDE'],['SIDE','ArrowLeft','AUTO'],['AUTO','ArrowLeft','HIDE'],['HIDE','ArrowRight','AUTO'],['SIDE','End','HIDE'],['BOTTOM','Home','AUTO']]){
    h.button(from).focus();assert.equal(keydown(h.button(from),key).defaultPrevented,true);assert.equal(focusedElement(h.document),h.button(to));assert.deepEqual(pressed(h.document),['AUTO']);
  }
  for(const key of ['Tab','Escape','ArrowUp','ArrowDown'])assert.equal(keydown(h.button('SIDE'),key).defaultPrevented,false);
  assert.equal(h.writes.length,before);await h.click('SIDE');assert.deepEqual(pressed(h.document),['SIDE']);h.runTimers(300);assert.equal(h.writes.at(-1).tccPreferences.mode,'side');
});

test('VOD header uses live 36px/24px sizing and responsive spacing, with no separate VOD button CSS',()=>{
  const h=fixture(),css=style(h.document),source=fs.readFileSync(path.join(__dirname,'../extension/vod.js'),'utf8');
  assert.match(css,/\.bar\{[^}]*height:36px;[^}]*gap:12px;[^}]*padding:5px 14px/);
  assert.match(css,/button\{height:24px;min-height:24px;[^}]*font:12px\/20px/);
  assert.match(css,/\.title\{[^}]*font-size:12px;font-weight:650/);
  assert.match(css,/\.mode\{[^}]*font-size:11px;font-weight:600/);
  assert.match(css,/@media\(max-width:500px\)\{\.bar\{gap:6px;padding:5px 8px/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/:host\{all:initial;/);assert.match(css,/\.notice:empty\{display:none\}/);assert.match(css,/\.notice\{[^}]*pointer-events:none/);
  assert.doesNotMatch(source,/function makeBar|\.bar\{|button\{|36px|innerHeight-36/);
});

test('VOD layout and shared header height stay aligned for all modes and narrow windows',async()=>{
  const h=fixture();for(const width of [1200,960,700,420,360,320])for(const height of [620,220]){
    h.window.innerWidth=width;h.window.innerHeight=height;emit(h.window,'resize');
    for(const mode of Core.MODES){await h.click(mode.toUpperCase());const layout=Core.layout(mode,width,height),available=height-Core.HEADER_HEIGHT,chat=layout.mode==='hide'?0:Math.min(layout.chat,layout.mode==='side'?width:available);
      assert.equal(h.root.style.getPropertyValue('--tcc-vod-pw'),`${layout.mode==='side'?width-chat:width}px`);
      assert.equal(h.root.style.getPropertyValue('--tcc-vod-ph'),`${layout.mode==='bottom'?available-chat:available}px`);
      assert.equal(h.root.style.getPropertyValue('--tcc-vod-cy'),`${layout.mode==='bottom'?height-chat:Core.HEADER_HEIGHT}px`);
      assert.deepEqual(pressed(h.document),[mode.toUpperCase()]);assert.equal(h.video.pauseCount,0);assert.equal(h.replay.isConnected,true);
    }
  }
});

for(const exit of ['URL changed','player detached','replay detached','consent withdrawn','pagehide','BFCache'])test(`VOD stale mode controls are inert after ${exit}`,()=>{
  const h=fixture(),button=h.button('HIDE');if(exit==='URL changed')h.location.href='https://www.twitch.tv/videos/987654321?tcc_vod=1';
  else if(exit==='player detached')h.player.remove();else if(exit==='replay detached')h.replay.remove();else if(exit==='consent withdrawn')h.changeConsent(undefined);else emit(h.window,'pagehide',{persisted:exit==='BFCache'});
  emit(button,'click');h.runTimers(300);assert.equal(h.writes.some(write=>write.tccPreferences?.mode==='hide'),false);assert.equal(h.video.pauseCount,0);assert.equal(h.pipRequests.length,0);
});

test('shared toolbar is header-only, accepts extra controls, reports meaningful status, and cleans up',()=>{
  const h=createHarness({consent:false});let calls=0;const created=[],original=h.document.createElement.bind(h.document);h.document.createElement=tag=>{created.push(tag);return original(tag);};
  const toolbar=h.context.TCCUI.makeToolbar({doc:h.document,title:'Archive',mode:'side',onMode:()=>calls++,id:'test-toolbar',windowMode:'test-header'});
  assert.equal(created.includes('iframe'),false);assert.equal(created.includes('script'),false);assert.equal(h.opened.length,0);assert.equal(h.pipRequests.length,0);assert.equal(h.document.querySelector('#test-toolbar'),null);
  h.document.body.append(toolbar.host);assert.equal(toolbar.host.getAttribute('data-tcc-window-mode'),'test-header');const notice=elements(h.document).find(el=>el.getAttribute('role')==='status');assert.equal(notice.textContent,'');assert.equal(notice.getAttribute('aria-live'),'polite');toolbar.status('Unable to open the requested window.');assert.equal(notice.textContent,'Unable to open the requested window.');toolbar.setMode('hide');assert.deepEqual(pressed(h.document),['HIDE']);
  const extra=h.document.createElement('button');extra.textContent='Extra';toolbar.bar.append(extra);assert.equal(toolbar.bar.lastElementChild,extra);
  const mode=h.button('AUTO');mode.click();assert.equal(calls,1);toolbar.destroy();emit(mode,'click');assert.equal(calls,1);assert.equal(toolbar.host.isConnected,false);toolbar.status('stale');assert.equal(notice.textContent,'Unable to open the requested window.');
});

test('VOD runtime and all catalogs omit the removed return action and persistent trial notice',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../extension/vod.js'),'utf8');assert.doesNotMatch(source,/vodRestore|vodPreview|dismissedPopup|onRestore|makeBar/);assert.match(source,/TCCUI\.makeToolbar/);
  for(const locale of locales){const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../extension/_locales',locale,'messages.json'),'utf8'));assert.equal(catalog.vodRestore,undefined);assert.equal(catalog.vodPreview,undefined);}
  const h=fixture();const buttons=deepElements(part(h.document,'bar')).filter(el=>el.tagName==='BUTTON');assert.equal(buttons.length,4);assert.equal(h.document.querySelector('[data-tcc-gear-entry]'),null);assert.equal(h.document.querySelectorAll('#tcc-vod-controls').length,1);assert.equal(h.context.TCCVod.create({window:h.window,document:h.document}).openPip,undefined);
});
