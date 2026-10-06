'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHarness,deepElements,Document}=require('./helpers/mock-browser.cjs');
const root=path.join(__dirname,'../extension');
const locales=['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const catalog=locale=>JSON.parse(fs.readFileSync(path.join(root,'_locales',locale,'messages.json'),'utf8'));
const part=(doc,name)=>deepElements(doc.documentElement).find(e=>e.className.split(' ').includes(name));

test('all 11 packaged catalogs have identical complete keys and bounded manifest fields',()=>{
  const expected=Object.keys(catalog('en')).sort();
  assert.deepEqual(fs.readdirSync(path.join(root,'_locales')).sort(),locales.toSorted());
  for(const locale of locales){const messages=catalog(locale);assert.deepEqual(Object.keys(messages).sort(),expected);
    for(const [key,entry]of Object.entries(messages)){assert.equal(typeof entry.message,'string',`${locale}:${key}`);assert.ok(entry.message.trim(),`${locale}:${key}`);assert.doesNotMatch(entry.message,/[<>]|__MSG_/);for(const match of entry.message.matchAll(/\$([A-Z_]+)\$/gi))assert.ok(entry.placeholders?.[match[1].toLowerCase()]||entry.placeholders?.[match[1]],`${locale}:${key}: ${match[1]}`);}
    assert.ok([...messages.extensionName.message].length<=75);assert.ok([...messages.extensionDescription.message].length<=132);
    assert.equal(messages.extensionName.message,catalog('en').extensionName.message);
  }
});

test('runtime and popup message references are supplied by every locale, without inline Japanese UI',()=>{
  const files=['i18n.js','ui.js','content.js','help.js','help.html','onboarding.js','onboarding.html'];
  const sources=files.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
  const keys=[...sources.matchAll(/(?:\bt|\bmessage)\('([A-Za-z]\w*)'/g)].map(m=>m[1]);
  keys.push(...[...sources.matchAll(/data-i18n="([A-Za-z]\w*)"/g)].map(m=>m[1]));
  for(const locale of locales)for(const key of keys)assert.ok(catalog(locale)[key],`${locale}:${key}`);
  assert.doesNotMatch(sources,/[\u3040-\u30ff\u3400-\u9fff]/);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.equal(manifest.default_locale,'en');assert.equal(manifest.name,'__MSG_extensionName__');assert.equal(manifest.description,'__MSG_extensionDescription__');assert.equal(manifest.action.default_title,'__MSG_actionTitle__');
});

for(const locale of locales){
  test(`${locale}: localized gear, window, tooltips, reload, and separate chat retain exact six-button UI`,async()=>{
    const h=createHarness({locale});const m=catalog(locale);h.openGear();
    const entry=h.button(m.gearEntry.message);assert.ok(entry);assert.equal(entry.lang,locale.replaceAll('_','-'));assert.equal(entry.dir,locale==='ar'?'rtl':'ltr');
    entry.click();for(let i=0;i<8;i++)await Promise.resolve();
    const win=h.pipWindows[0],doc=win.document;assert.equal(doc.documentElement.lang,locale.replaceAll('_','-'));assert.equal(doc.documentElement.dir,locale==='ar'?'rtl':'ltr');
    assert.equal(h.pipRequests.length,1);assert.equal(h.opened.length,0);assert.equal(h.video.ownerDocument,doc);
    assert.deepEqual(deepElements(part(doc,'bar')).filter(e=>e.tagName==='BUTTON').map(e=>e.textContent),['AUTO','SIDE','BOTTOM','HIDE',m.reloadLabel.message,m.separateLabel.message]);
    assert.equal(part(doc,'modes').getAttribute('aria-label'),m.layoutGroup.message);
    for(const [mode,key]of [['AUTO','modeAutoTitle'],['SIDE','modeSideTitle'],['BOTTOM','modeBottomTitle'],['HIDE','modeHideTitle']])assert.equal(h.button(mode,doc).title,m[key].message);
    const frame=deepElements(doc.documentElement).find(e=>e.tagName==='IFRAME');assert.ok(frame.title.includes('example'));assert.doesNotMatch(frame.title,/\$CHANNEL\$/i);const loads=frame.srcAssignments.length;
    await h.click(m.reloadLabel.message,doc);assert.equal(frame.srcAssignments.length,loads+1);await h.click(m.separateLabel.message,doc);assert.equal(h.opened.length,1);assert.equal(h.video.pauseCount,0);
    win.close();assert.equal(h.video.parentNode,h.container);assert.equal(h.document.querySelector('#tcc-placeholder'),null);
  });
  test(`${locale}: localized native popout keeps official gear and same source video`,()=>{
    const h=createHarness({locale,url:'https://player.twitch.tv/?channel=example'});h.openGear();assert.equal(h.document.querySelector('[data-tcc-gear-entry]'),null);assert.equal(h.video.parentNode,h.container);assert.ok(h.button(catalog(locale).reloadLabel.message));assert.equal(h.pipRequests.length,0);
  });
}

test('Arabic reading direction is isolated without reversing physical SIDE or compact mode order',async()=>{
  const h=createHarness({locale:'ar',url:'https://player.twitch.tv/?channel=example'});
  assert.equal(h.document.querySelector('#tcc-panel').dir,'rtl');assert.equal(h.button(catalog('ar').reloadLabel.message).dir,'rtl');
  const css=deepElements(h.document.documentElement).find(e=>e.tagName==='STYLE').textContent;
  for(const rule of ['bar','area','modes'])assert.match(css,new RegExp(`\\.${rule}\\{direction:ltr;`));
  await h.click('SIDE');assert.equal(part(h.document,'area').className,'area side');assert.equal(part(h.document,'area').children[1].className,'chat');
  h.keydown(h.button('AUTO'),'ArrowRight');assert.equal(h.focusedElement(h.document),h.button('SIDE'));
});

test('unsupported browser locale uses complete English fallback',()=>{
  const h=createHarness({locale:'xx'});h.openGear();assert.ok(h.button(catalog('en').gearEntry.message));assert.equal(h.context.TCCI18n.language,'en');
});


test('all verified native Twitch labels work independently of the 11 extension UI languages',()=>{
  // Source values, not translations invented by the extension; see evidence doc.
  const labels=['ポップアウト','Popout Player','팝업 플레이어','弹出播放器','Reproductor emergente','Pop-out-Player','Ouvrir dans nouvelle fenêtre','Открыть в отдельном окне','مشغّل منبثق'];
  for(const locale of locales)for(const label of labels){
    let nativeClicks=0;const h=createHarness({locale});const {nativeButton,nativeRow}=h.openGear({label,nativeAction:()=>nativeClicks++});
    const entry=h.button(catalog(locale).gearEntry.message);assert.ok(entry,`${locale}:${label}`);assert.equal(nativeRow.nextSibling,entry.parentNode);assert.equal(nativeButton.textContent,label);
    nativeButton.click();assert.equal(nativeClicks,1);assert.equal(h.pipRequests.length,0);
  }
});
