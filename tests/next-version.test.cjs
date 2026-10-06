'use strict';
// v1.4 gear-only contract: DOM/API doubles plus shipped-source dead-code audit.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness,emit,deepElements}=require('./helpers/mock-browser.cjs');
const nativeURLs=['https://player.twitch.tv/?channel=example','https://www.twitch.tv/example/popout'];
const topLabel='ポップアウト（最前面）';
const all=(doc,p)=>deepElements(doc.documentElement).filter(p);
const part=(doc,name)=>all(doc,e=>e.className.split(' ').includes(name))[0];
const source=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');

for(const url of ['https://www.twitch.tv/example',...nativeURLs]){
  test(`old standalone controls and diagnostics never appear: ${url}`,()=>{
    const h=createHarness({url});h.openGear();
    for(const id of ['tcc-launcher','tcc-source-notice','tcc-native-restore','tcc-pip-choice'])assert.equal(h.document.querySelector(`#${id}`),null);
    for(const text of ['最前面','⋯','戻す','別の最前面小窓へ移す','チャット表示に戻す','標準PiP試験を準備','標準PiP試験を開く','試験を終了'])assert.equal(h.button(text),undefined);
    assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);assert.equal(h.video.parentNode,h.container);
    if(nativeURLs.includes(url)){assert.equal(h.button(topLabel),undefined);assert.equal(part(h.document,'pip-choice'),undefined);assert.equal(h.document.querySelector('[data-tcc-gear-row]'),null);}
  });
}

for(const url of ['https://www.twitch.tv/directory','https://www.twitch.tv/popout/example/chat','https://www.twitch.tv/embed/example/chat','https://www.twitch.tv/videos/123','https://player.twitch.tv/?video=v123']){
  test(`unsupported route never mounts extension controls or iframe: ${url}`,()=>{
    const h=createHarness({url});h.openGear();assert.equal(h.button(topLabel),undefined);assert.equal(h.document.querySelector('#tcc-panel'),null);assert.equal(all(h.document,e=>e.tagName==='IFRAME').length,0);assert.equal(h.observers.filter(o=>o.active).length,0);
  });
}

test('nested frames do not start extension lifecycle or inject gear rows',()=>{
  const h=createHarness({nested:true});h.openGear();assert.equal(h.button(topLabel),undefined);assert.equal(h.observers.filter(o=>o.active).length,0);assert.equal(h.context.__tccStarted,undefined);
});

for(const api of [undefined,{}, {requestWindow:true}]){
  test(`noncallable Document PiP cannot add an entry or fallback launcher: ${JSON.stringify(api)}`,()=>{
    const h=createHarness({pip:false,setup:({window})=>{window.documentPictureInPicture=api;}});h.openGear();assert.equal(h.button(topLabel),undefined);assert.equal(h.document.querySelector('#tcc-launcher'),null);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);assert.equal(h.video.parentNode,h.container);assert.equal(h.observers.filter(o=>o.active).length,0);
  });
}

test('browser-native video PiP is left intact, without diagnostic listeners or guidance UI',()=>{
  let calls=0;const request=()=>{calls++;return Promise.resolve();};const h=createHarness({setup:({video})=>{video.requestPictureInPicture=request;}});const event=emit(h.document,'enterpictureinpicture',{target:h.video});assert.equal(event.defaultPrevented,false);assert.equal(h.video.requestPictureInPicture,request);assert.equal(calls,0);assert.equal(h.pipRequests.length,0);assert.equal(h.opened.length,0);assert.equal(h.video.parentNode,h.container);assert.equal(all(h.document,e=>e.getAttribute('role')==='status').length,0);
});

test('manifest loads only the five live content modules, retains minimum permissions, and excludes former canvas module',()=>{
  const manifest=JSON.parse(source('manifest.json'));assert.deepEqual(manifest.content_scripts[0].js,['i18n.js','core.js','gear-menu.js','ui.js','content.js']);assert.deepEqual(manifest.permissions,['storage']);assert.deepEqual(manifest.background,{service_worker:'background.js'});assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.web_accessible_resources,undefined);assert.equal(manifest.content_scripts[0].all_frames,false);assert.equal(fs.existsSync(path.join(__dirname,'../extension/native-pip.js')),false);
});

test('shipped runtime has no obsolete launcher, diagnostic, Canvas, frame-copy or timer-polling implementation',()=>{
  const runtime=fs.readdirSync(path.join(__dirname,'../extension')).filter(file=>/\.(?:js|css|html)$/.test(file)).map(file=>source(file)).join('\n');
  for(const forbidden of [/TCCNativePip/,/makeLauncher/,/makeSourceNotice/,/makeNativeRestore/,/tcc-launcher/,/tcc-source-notice/,/tcc-native-restore/,/tcc-pip-choice/,/native-pip\.js/,/captureStream\s*\(/,/drawImage\s*\(/,/requestVideoFrameCallback\s*\(/,/createElement\s*\(\s*['"]canvas['"]/,/setInterval\s*\(/,/enterpictureinpicture/,/leavepictureinpicture/,/標準PiP試験/,/Twitch本来の表示に一時的に戻す/])assert.doesNotMatch(runtime,forbidden);
  assert.doesNotMatch(source('ui.js'),/makeMenu|menu-toggle|pip-choice|launcher-hint|native-restore|onNativeView|onClose|\.menu\{/);
});

test('native player CSS preserves previous gear-menu pass-through fix without root clipping or stacking',()=>{
  const css=source('content.css');const rule=css.match(/\[data-tcc-player-root\]\s*\{([^}]+)\}/)[1];assert.doesNotMatch(rule,/(?:^|[;\s])(?:z-index|contain|overflow(?:-[xy])?)\s*:/);
  for(const url of nativeURLs){const h=createHarness({url});assert.equal(h.document.querySelector('#tcc-panel').style.pointerEvents,'none');assert.equal(part(h.document,'video').style.pointerEvents,'');assert.equal(part(h.document,'video').style.background,'transparent');assert.equal(part(h.document,'bar').style.pointerEvents,'auto');assert.equal(part(h.document,'chat').style.pointerEvents,'auto');h.openGear();assert.equal(h.button(topLabel),undefined);assert.equal(h.video.parentNode,h.container);}
});

test('native scroll lock is attribute scoped and cleanup preserves prior inline overflow and layout variables',()=>{
  const h=createHarness({url:nativeURLs[0],setup:({document,root})=>{document.documentElement.style.setProperty('overflow','scroll','important');document.body.style.setProperty('overflow','auto');root.style.setProperty('--tcc-player-width','91vw','important');root.style.setProperty('--tcc-player-height','87vh');}});const htmlStyle=h.document.documentElement.getAttribute('style'),bodyStyle=h.document.body.getAttribute('style');assert.match(source('content.css'),/html\[data-tcc-popout-active\],\s*html\[data-tcc-popout-active\]\s+body\s*\{overflow:hidden!important;\}/);
  h.location.href='https://www.twitch.tv/directory';emit(h.window.navigation,'navigatesuccess');h.runTimers(200);assert.equal(h.document.documentElement.getAttribute('data-tcc-popout-active'),null);assert.equal(h.document.documentElement.getAttribute('style'),htmlStyle);assert.equal(h.document.body.getAttribute('style'),bodyStyle);assert.equal(h.root.style.getPropertyValue('--tcc-player-width'),'91vw');assert.equal(h.root.style.getPropertyPriority('--tcc-player-width'),'important');assert.equal(h.root.style.getPropertyValue('--tcc-player-height'),'87vh');assert.equal(h.root.getAttribute('data-tcc-player-root'),null);
});
