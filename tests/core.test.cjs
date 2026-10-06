'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/core.js');
test('live channel routes and both player popout forms', () => {
  assert.deepEqual(core.parseLocation('https://www.twitch.tv/Example_1'), {channel:'example_1',popout:false,hostname:'www.twitch.tv'});
  assert.equal(core.parseLocation('https://www.twitch.tv/example/popout').popout,true);
  assert.equal(core.parseLocation('https://player.twitch.tv/?channel=example&parent=www.twitch.tv').channel,'example');
});
test('reject unsupported or malicious routes, chat-only frames, clips and VOD', () => {
  for (const url of ['http://www.twitch.tv/name','https://www.twitch.tv.evil.test/name','https://evil.test/name','https://twitch.tv/name','javascript:alert(1)','https://www.twitch.tv/popout/name/chat','https://www.twitch.tv/embed/name/chat','https://www.twitch.tv/videos/123','https://www.twitch.tv/name/videos','https://www.twitch.tv/name/clip/abc','https://www.twitch.tv/settings','https://player.twitch.tv/?video=123','https://player.twitch.tv/?channel=%3Cscript%3E','https://www.twitch.tv/%22onload%3D','https://www.twitch.tv/']) assert.equal(core.parseLocation(url),null,url);
});
test('channel validation and safe official URLs', () => {
  assert.equal(core.channelName('A_b123'),'a_b123');
  for (const input of [null,undefined,42,'','x'.repeat(26),'a/b','x&parent=evil.test','abc%00','あ']) assert.equal(core.channelName(input),null);
  const url=new URL(core.chatURL('Example','player.twitch.tv'));
  assert.equal(url.origin,'https://www.twitch.tv');assert.equal(url.pathname,'/embed/example/chat');assert.equal(url.searchParams.get('parent'),'player.twitch.tv');
  assert.throws(()=>core.chatURL('okay','evil.test'));
  assert.throws(()=>core.chatURL('<script>','www.twitch.tv'));
  assert.equal(core.chatPopoutURL('TEST'),'https://www.twitch.tv/popout/test/chat?popout=');
});
test('settings normalize corrupted persisted values and never save extra data', () => {
  assert.deepEqual(core.settings(null),core.DEFAULTS);
  assert.deepEqual(core.settings({mode:'flow',width:Infinity,height:'900',token:'secret'}),core.DEFAULTS);
  assert.deepEqual(core.settings({mode:'side',width:2,height:1e7}),{mode:'side',width:420,height:1200});
  assert.deepEqual(Object.keys(core.settings({channel:'test'})),['mode','width','height']);
});
test('AUTO responsive mode and manual mode persistence', () => {
  assert.equal(core.layout('auto',1200,700).mode,'side');
  assert.equal(core.layout('auto',600,800).mode,'bottom');
  assert.equal(core.layout('auto',900,900).mode,'bottom');
  assert.equal(core.layout('side',400,800).mode,'side');
  assert.equal(core.layout('bottom',1200,700).mode,'bottom');
  assert.equal(core.layout('side',3000,800).chat,360);
  assert.equal(core.layout('bottom',200,100).chat,180);
});
