'use strict';
// Public runtime, all packaged locales, deterministic DOM/API doubles only.
// These tests verify lookup/rendering paths, not linguistic quality or live Twitch.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness,emit,deepElements}=require('./helpers/mock-browser.cjs');
const root=path.join(__dirname,'../extension');
const locales=['ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'];
const catalog=locale=>JSON.parse(fs.readFileSync(path.join(root,'_locales',locale,'messages.json'),'utf8'));
const archive='https://www.twitch.tv/videos/1234567890';
function fixture(locale,options={}){
  return createHarness({...options,locale,url:options.url||archive,setup({document,root,video}){
    root.id='root';video.currentTime=42.75;if(options.replay!==false){const replay=document.createElement('section');replay.className='video-chat';root.append(replay);}
  }});
}
const entry=h=>h.document.querySelector('[data-tcc-gear-entry]');
const notice=h=>h.document.querySelector('[data-tcc-gear-status]');
function localMessage(h,locale,key,actual){
  const messages=catalog(locale);assert.ok(Object.hasOwn(messages,key));assert.equal(actual,messages[key].message,`${locale}: exact ${key} rendered`);
  assert.ok(h.i18nLookups.some(call=>call.key===key&&call.locale===locale),`${locale}: ${key} was actually requested from local catalog`);
  if(locale!=='en')assert.notEqual(actual,catalog('en')[key].message,`${locale}: unintended English fallback for ${key}`);
  assert.doesNotMatch(actual,/__MSG_|\$[A-Z_]+\$/);
}
function finish(h,locale){
  for(const {key,locale:selected} of h.i18nLookups){assert.equal(selected,locale);if(!key.startsWith('@@'))assert.ok(Object.hasOwn(catalog(locale),key),`${locale}: locally complete lookup ${key}`);}
  assert.equal(h.pipRequests.length,0);assert.equal(deepElements(h.document.documentElement).filter(node=>node.tagName==='IFRAME').length,0);emit(h.window,'pagehide',{persisted:false});
}

for(const locale of locales){
  test(`${locale}: VOD source and embedded entries report localized popup success`,()=>{
    for(const [url,key] of [[archive,'vodPopupEntry'],['https://player.twitch.tv/?video=v1234567890','vodOpenPage']]){
      const h=fixture(locale,{url});h.openGear({label:'Popout Player'});localMessage(h,locale,key,entry(h).textContent);assert.equal(entry(h).getAttribute('aria-label'),catalog(locale)[key].message);
      entry(h).click();localMessage(h,locale,'vodPopupOpened',notice(h).textContent);assert.equal(notice(h).getAttribute('role'),'status');assert.equal(notice(h).getAttribute('aria-live'),'polite');assert.equal(h.opened[0][0],`${archive}?t=0h0m42s&tcc_vod=1`);assert.equal(h.video.pauseCount,1);finish(h,locale);
    }
  });
  test(`${locale}: VOD blocked and throwing popup paths use their own localized error`,()=>{
    for(const failure of ['blocked','throws']){
      const h=fixture(locale,{popupBlocked:failure==='blocked'});if(failure==='throws')h.window.open=()=>{throw new Error('Synthetic popup failure');};h.openGear();entry(h).click();localMessage(h,locale,'vodErrorPopupBlocked',notice(h).textContent);
      assert.equal(h.video.pauseCount,0);assert.equal(h.video.ownerDocument,h.document);assert.equal(h.i18nLookups.some(call=>call.key==='errorPopupBlocked'),false,'VOD does not reuse the live-only popup error');finish(h,locale);
    }
  });
  test(`${locale}: absent video is inert and stale primary video reports a localized VOD error`,()=>{
    const absent=fixture(locale,{video:false});absent.openGear();assert.equal(entry(absent),null);assert.equal(absent.document.querySelector('#tcc-vod-controls'),null);assert.equal(absent.opened.length,0);finish(absent,locale);
    // A detached source is rejected by the menu adapter before invoking VOD.
    // Keeping the old source connected while a new main player appears reaches
    // the runtime's current-video mismatch branch through an actual menu click.
    const h=fixture(locale);h.openGear();h.video.rect={width:1,height:1};const replacement=h.document.createElement('video');replacement.rect={width:1200,height:700};replacement.currentTime=123;h.container.append(replacement);entry(h).click();localMessage(h,locale,'vodErrorVideoMissing',notice(h).textContent);
    assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);assert.equal(replacement.pauseCount,0);assert.equal(h.i18nLookups.some(call=>call.key==='errorVideoMissing'),false,'VOD does not ask users to play a live stream');finish(h,locale);
  });
  test(`${locale}: missing replay reports the packaged localized explanation without a fake chat`,()=>{
    const h=fixture(locale,{url:`${archive}?tcc_vod=1`,replay:false});h.openGear();localMessage(h,locale,'vodUnavailable',notice(h).textContent);assert.equal(h.document.documentElement.hasAttribute('data-tcc-vod-active'),false);assert.equal(h.document.querySelector('#tcc-vod-controls'),null);assert.equal(h.opened.length,0);assert.equal(h.video.pauseCount,0);finish(h,locale);
  });
}
