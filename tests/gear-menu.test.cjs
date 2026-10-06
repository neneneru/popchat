'use strict';
// Deterministic DOM doubles verify selectors, lifecycle, and synchronous gesture
// dispatch. They do not establish actual Twitch rendering or browser/OS PiP.
const test = require('node:test');
const assert = require('node:assert/strict');
const {Document, emit} = require('./helpers/mock-browser.cjs');
const {create} = require('../extension/gear-menu.js');
const LABEL = 'ポップアウト（最前面）';

function harness({withMenu = true, onOpen} = {}) {
  const document = new Document(), timers = new Map(), observers = [];
  let time = 0, nextTimer = 0, opens = 0;
  const window = {
    document,
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, {fn, at:time + ms}); return id; },
    clearTimeout(id) { timers.delete(id); },
    getComputedStyle(node) { return {display:node.style.display || 'block', visibility:node.style.visibility || 'visible'}; },
    MutationObserver:class {
      constructor(fn) { this.fn = fn; this.active = false; this.observations = []; observers.push(this); }
      observe(target, settings) { this.active = true; this.observations.push({target, settings}); }
      disconnect() { this.active = false; this.observations = []; }
    }
  };
  const app = document.createElement('main'), player = document.createElement('div'); player.className = 'video-player';
  const videoBox = document.createElement('div'), video = document.createElement('video');
  const gear = document.createElement('button'); gear.textContent = 'Settings';
  videoBox.append(video); player.append(videoBox, gear); app.append(player); document.body.append(app);
  const portal = document.createElement('div'); app.append(portal);
  const controller = create({window, document, label:LABEL, onOpen(event) { opens++; onOpen?.(event); }});
  function addNative(menu, label = 'ポップアウト') {
    const row = document.createElement('div'); row.className = 'Layout-sc-1xc eDiLRr';
    const button = document.createElement('button'); button.className = 'ScInteractable tw-interactable';
    button.setAttribute('role', 'menuitem');
    const flex = document.createElement('div'); flex.className = 'Layout-sc-1xc dmmLGq';
    const text = document.createElement('div'); text.className = 'Layout-sc-1xc dmulKQ'; text.textContent = label;
    flex.append(text); button.append(flex); row.append(button); menu.append(row);
    return {row, button, flex, text};
  }
  function addMenu({hidden = false, label} = {}) {
    const transition = document.createElement('div'); transition.setAttribute('aria-hidden', String(hidden));
    const wrap = document.createElement('div'), menu = document.createElement('div'); menu.setAttribute('data-a-target', 'player-settings-menu');
    wrap.append(menu); transition.append(wrap); portal.append(transition);
    return {transition, wrap, menu, native:addNative(menu, label)};
  }
  function mutate(target, type = 'childList', extra = {}) {
    const record = {target, type, addedNodes:[], removedNodes:[], ...extra};
    for (const observer of [...observers]) {
      if (!observer.active) continue;
      if (observer.observations.some(({target:scope, settings}) =>
        (scope === target || (settings.subtree && scope.contains(target))) &&
        (type === 'childList' ? settings.childList : type === 'characterData' ? settings.characterData :
          settings.attributes && (!settings.attributeFilter || settings.attributeFilter.includes(extra.attributeName))))) observer.fn([record]);
    }
  }
  function advance(ms) {
    const until = time + ms;
    while (true) {
      const entry = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      timers.delete(entry[0]); time = entry[1].at; entry[1].fn();
    }
    time = until;
  }
  const fixture = withMenu ? addMenu() : null;
  return {document, window, app, player, videoBox, video, gear, portal, controller, timers, observers,
    fixture, addMenu, addNative, mutate, advance,
    get opens() { return opens; },
    entry() { return document.querySelector('[data-tcc-gear-entry]'); },
    ownRow() { return document.querySelector('[data-tcc-gear-row]'); },
    interact(target = gear, type = 'click', key) { return emit(document, type, {target, ...(key ? {key} : {})}); },
    changeAttribute(node, name, value) { node.setAttribute(name, value); mutate(node, 'attributes', {attributeName:name}); advance(40); }
  };
}

test('adds exactly one fresh adjacent row using only the verified native classes', () => {
  const h = harness(), {menu, native} = h.fixture;
  let nativeClicks = 0;
  native.button.addEventListener('click', () => nativeClicks++);
  native.button.setAttribute('data-a-target', 'native-only'); native.button.setAttribute('title', 'Native title');
  const originalAttributes = [...native.button.attributes], originalChildren = [...menu.children];
  h.controller.start(h.video);
  const own = h.entry(), row = h.ownRow();
  assert.ok(own); assert.notEqual(own, native.button); assert.notEqual(row, native.row);
  assert.equal(native.row.nextSibling, row); assert.equal(row.parentElement, menu);
  assert.equal(own.textContent, LABEL); assert.equal(own.type, 'button'); assert.equal(own.getAttribute('role'), 'menuitem');
  assert.equal(own.className, native.button.className); assert.equal(row.className, native.row.className);
  assert.equal(own.children[0].className, native.flex.className);
  assert.equal(own.children[0].children[0].className, native.text.className);
  assert.equal(own.getAttribute('data-a-target'), null); assert.equal(own.getAttribute('title'), null);
  h.controller.refresh(); h.controller.start(h.video);
  assert.equal(h.document.querySelectorAll('[data-tcc-gear-row]').length, 1);
  emit(native.button, 'click'); assert.equal(nativeClicks, 1); assert.equal(h.opens, 0);
  emit(own, 'click'); assert.equal(h.opens, 1); assert.equal(nativeClicks, 1);
  assert.deepEqual([...native.button.attributes], originalAttributes);
  h.controller.stop(); assert.deepEqual(menu.children, originalChildren);
});

test('own click synchronously consumes its event and invokes onOpen in the same call stack', () => {
  const calls = [];
  const h = harness({onOpen(event) { calls.push('open'); assert.equal(event.defaultPrevented, true); assert.equal(event.cancelBubble, true); }});
  h.controller.start(h.video); calls.push('before'); emit(h.entry(), 'click'); calls.push('after');
  assert.deepEqual(calls, ['before', 'open', 'after']);
  assert.equal(h.entry().getAttribute('aria-label'), LABEL);
});

test('keyboard observation does not consume native keys or invoke a native control', () => {
  const h = harness(); h.controller.start(h.video);
  for (const key of ['Enter', ' ', 'Escape', 'ArrowDown']) {
    assert.equal(h.interact(h.fixture.native.button, 'keydown', key).defaultPrevented, false);
    assert.equal(h.interact(h.entry(), 'keydown', key).defaultPrevented, false);
  }
  assert.equal(h.opens, 0);
  // Enter/Space activation is supplied by the browser because this is a native
  // button. Model the resulting click; the mock does not emulate browser keys.
  emit(h.entry(), 'click', {detail:0}); assert.equal(h.opens, 1);
});

test('exact Japanese whitespace-normalized and official English labels are supported', () => {
  for (const label of ['  ポップアウト \n', 'Popout Player', '  Popout\n  Player  ']) {
    const h = harness({withMenu:false}); h.addMenu({label}); h.controller.start(h.video);
    assert.ok(h.entry(), label); h.controller.stop();
  }
});

test('unknown menu structures and similar labels fail closed', () => {
  const cases = [
    h => h.fixture.menu.setAttribute('data-a-target', 'unrelated-menu'),
    h => h.fixture.native.button.removeAttribute('role'),
    h => { h.fixture.native.text.textContent = 'ポップアウトを開く'; },
    h => { const inner = h.document.createElement('div'); h.fixture.native.row.remove(); inner.append(h.fixture.native.row); h.fixture.menu.append(inner); },
    h => { h.fixture.native.flex.append(h.document.createElement('span')); },
    h => { h.fixture.native.text.append(h.document.createElement('span')); },
    h => { h.fixture.native.row.append(h.document.createElement('button')); },
    h => { h.fixture.native.button.disabled = true; },
    h => h.fixture.native.button.setAttribute('aria-disabled', 'true'),
    h => { h.fixture.native.button.rect = {width:0, height:0}; }
  ];
  for (const change of cases) {
    const h = harness(); change(h); h.controller.start(h.video);
    assert.equal(h.entry(), null); assert.equal(h.opens, 0); h.controller.stop();
  }
});

test('duplicate visible anchors or visible menu roots fail closed', () => {
  const h = harness(); h.addNative(h.fixture.menu); h.controller.start(h.video); assert.equal(h.entry(), null);
  h.controller.stop();
  const other = harness(); other.addMenu(); other.controller.start(other.video); assert.equal(other.entry(), null);
  other.controller.stop();
});

test('a stale own click fails closed when another visible menu appears before observation runs', () => {
  const h = harness(); h.controller.start(h.video); const own = h.entry();
  h.addMenu(); emit(own, 'click'); assert.equal(h.opens, 0);
  h.controller.refresh(); assert.equal(h.entry(), null);
});

test('a hidden duplicate anchor cannot replace or confuse the unique visible anchor', () => {
  const h = harness(), hidden = h.addNative(h.fixture.menu); hidden.row.hidden = true;
  h.controller.start(h.video); assert.equal(h.fixture.native.row.nextSibling, h.ownRow());
  assert.equal(hidden.row.parentElement, h.fixture.menu);
});

test('hidden transition removes the entry and a later opening restores it locally', () => {
  const h = harness(); h.fixture.transition.setAttribute('aria-hidden', 'true'); h.controller.start(h.video);
  assert.equal(h.entry(), null); assert.equal(h.controller.snapshot().discovering, false);
  h.changeAttribute(h.fixture.transition, 'aria-hidden', 'false'); assert.ok(h.entry());
  h.changeAttribute(h.fixture.transition, 'aria-hidden', 'true'); assert.equal(h.entry(), null);
  h.changeAttribute(h.fixture.transition, 'aria-hidden', 'false'); assert.ok(h.entry());
  assert.equal(h.document.querySelectorAll('[data-tcc-gear-row]').length, 1);
});

test('a submenu re-render without the exact anchor removes the entry and restores it when the anchor returns', () => {
  const h = harness(); h.controller.start(h.video);
  h.fixture.native.row.remove(); h.mutate(h.fixture.menu); h.advance(40); assert.equal(h.entry(), null);
  const replacement = h.addNative(h.fixture.menu); replacement.row.className = 'new-row';
  h.mutate(h.fixture.menu); h.advance(40);
  assert.ok(h.entry()); assert.equal(h.ownRow().className, 'new-row'); assert.equal(replacement.row.nextSibling, h.ownRow());
});

test('class changes copy presentation only and do not create duplicate rows', () => {
  const h = harness(); h.controller.start(h.video);
  h.fixture.native.button.className = 'new-native-button';
  h.mutate(h.fixture.native.button, 'attributes', {attributeName:'class'}); h.advance(40);
  assert.equal(h.entry().className, 'new-native-button');
  assert.equal(h.document.querySelectorAll('[data-tcc-gear-row]').length, 1);
});

test('removed own row and stale own duplicates recover without changing native rows', () => {
  const h = harness(); h.controller.start(h.video);
  h.ownRow().remove(); h.mutate(h.fixture.menu); h.advance(40); assert.ok(h.entry());
  const stale = h.document.createElement('div'); stale.setAttribute('data-tcc-gear-row', ''); h.fixture.menu.append(stale);
  h.mutate(h.fixture.menu); h.advance(40);
  assert.equal(stale.isConnected, false); assert.equal(h.document.querySelectorAll('[data-tcc-gear-row]').length, 1);
  assert.equal(h.fixture.native.row.parentElement, h.fixture.menu);
});

test('menu replacement disconnects the old scope and discovers its replacement', () => {
  const h = harness(); h.controller.start(h.video);
  const oldMenu = h.fixture.menu, oldEntry = h.entry();
  h.fixture.transition.remove(); h.mutate(h.portal); h.advance(40);
  assert.equal(oldEntry.isConnected, false); assert.equal(h.controller.snapshot().discovering, true);
  const replacement = h.addMenu(); h.mutate(h.portal); h.advance(40);
  assert.equal(h.ownRow().parentElement, replacement.menu); assert.equal(h.controller.snapshot().discovering, false);
  assert.equal(h.observers.some(observer => observer.active && observer.observations.some(({target}) => target === oldMenu)), false);
});

test('global discovery expires within two seconds despite continued unrelated mutations', () => {
  const h = harness({withMenu:false}); h.controller.start(h.video);
  const unrelated = h.document.createElement('div'); h.portal.append(unrelated);
  assert.equal(h.controller.snapshot().discovering, true);
  for (let i = 0; i < 19; i++) { h.mutate(unrelated); h.advance(100); }
  assert.equal(h.controller.snapshot().discovering, true);
  h.advance(100); assert.equal(h.controller.snapshot().discovering, false);
  h.advance(100); assert.equal(h.controller.snapshot().discovering, false);
  for (const observer of h.observers.filter(item => item.active)) {
    assert.ok(observer.observations.every(({settings}) => settings.subtree !== true));
  }
  h.mutate(unrelated); assert.equal(h.timers.size, 0);
});

test('fresh player click starts bounded discovery and catches a menu inserted after the handler', () => {
  const h = harness({withMenu:false}); h.controller.start(h.video); h.advance(2000);
  const event = h.interact(); assert.equal(event.defaultPrevented, false); assert.equal(event.cancelBubble, false);
  assert.equal(h.controller.snapshot().discovering, true);
  const fixture = h.addMenu(); h.mutate(h.portal); h.advance(40);
  assert.equal(h.ownRow().parentElement, fixture.menu); assert.equal(h.controller.snapshot().discovering, false);
  const recursive = h.observers.filter(observer => observer.active).flatMap(observer => observer.observations).filter(item => item.settings.subtree);
  assert.equal(recursive.length, 1); assert.equal(recursive[0].target, fixture.menu);
});

test('keyboard Enter and Space on player buttons discover late menus without hijacking keys', () => {
  for (const key of ['Enter', ' ', 'Spacebar']) {
    const h = harness({withMenu:false}); h.controller.start(h.video); h.advance(2000);
    assert.equal(h.interact(h.gear, 'keydown', key).defaultPrevented, false);
    assert.equal(h.controller.snapshot().discovering, true);
    h.addMenu(); h.mutate(h.portal); h.advance(40); assert.ok(h.entry()); h.controller.stop();
  }
});

test('unrelated outside clicks and other keys do not restart global observation', () => {
  const h = harness({withMenu:false}); h.controller.start(h.video); h.advance(2000);
  const outside = h.document.createElement('button'); h.portal.append(outside);
  h.interact(outside); h.interact(h.gear, 'keydown', 'ArrowRight');
  assert.equal(h.controller.snapshot().discovering, false); assert.equal(h.timers.size, 0);
});

test('a source directly under body never treats all page buttons as nearby player controls', () => {
  const h = harness({withMenu:false}); h.document.body.append(h.video);
  h.controller.start(h.video); h.advance(2000); h.interact(h.gear);
  assert.equal(h.controller.snapshot().discovering, false); assert.equal(h.timers.size, 0);
});

test('moving the same source into another player rebinds nearby interactions and removal observation', () => {
  const h = harness({withMenu:false}); h.controller.start(h.video); h.advance(2000);
  const secondPlayer = h.document.createElement('div'); secondPlayer.className = 'video-player';
  const secondBox = h.document.createElement('div'), secondGear = h.document.createElement('button');
  secondBox.append(h.video); secondPlayer.append(secondBox, secondGear); h.app.append(secondPlayer);
  h.mutate(h.videoBox); h.advance(40);
  h.interact(h.gear); assert.equal(h.controller.snapshot().discovering, false);
  h.interact(secondGear); assert.equal(h.controller.snapshot().discovering, true);
  h.video.remove(); h.mutate(secondBox); h.advance(40); assert.equal(h.controller.snapshot().active, false);
});

test('source removal tears down all rows, observers, timers, and event listeners', () => {
  const h = harness(); h.controller.start(h.video); const stale = h.entry();
  h.video.remove(); h.mutate(h.videoBox); h.advance(40);
  assert.equal(h.controller.snapshot().active, false); assert.equal(h.controller.snapshot().sourceConnected, false);
  assert.equal(h.entry(), null); assert.equal(h.observers.some(observer => observer.active), false); assert.equal(h.timers.size, 0);
  h.interact(); emit(stale, 'click'); assert.equal(h.opens, 0); assert.equal(h.timers.size, 0);
});

test('source changes rebind cleanly and detached or foreign-document videos fail closed', () => {
  const h = harness(); h.controller.start(h.video); const old = h.entry();
  const video = h.document.createElement('video'); h.videoBox.append(video); h.controller.start(video);
  assert.ok(h.entry()); assert.notEqual(h.entry(), old); emit(old, 'click'); assert.equal(h.opens, 0);
  h.controller.start(h.document.createElement('video')); assert.equal(h.controller.snapshot().active, false); assert.equal(h.entry(), null);
  const foreign = new Document(), foreignVideo = foreign.createElement('video'); foreign.body.append(foreignVideo);
  h.controller.start(foreignVideo); assert.equal(h.controller.snapshot().active, false);
});

test('diagnostics remain inside our row and persist across hiding, stopping, and reopening', () => {
  const h = harness(); const text = '最前面の小窓を開けませんでした。'; h.controller.setStatus(text); h.controller.start(h.video);
  let status = h.document.querySelector('[data-tcc-gear-status]');
  assert.equal(status.textContent, text); assert.equal(status.parentElement, h.ownRow()); assert.equal(status.hidden, false);
  assert.equal(h.entry().textContent, LABEL);
  h.changeAttribute(h.fixture.transition, 'aria-hidden', 'true'); assert.equal(h.document.querySelector('[data-tcc-gear-status]'), null);
  h.changeAttribute(h.fixture.transition, 'aria-hidden', 'false');
  assert.equal(h.document.querySelector('[data-tcc-gear-status]').textContent, text);
  h.controller.stop(); h.controller.start(h.video); status = h.document.querySelector('[data-tcc-gear-status]'); assert.equal(status.textContent, text);
  h.controller.setStatus(''); assert.equal(status.textContent, ''); assert.equal(status.hidden, true);
});

test('stop is idempotent and prevents late mutations, timers, or clicks from adding anything', () => {
  const h = harness({withMenu:false}); h.controller.start(h.video); h.interact(); h.controller.stop(); h.controller.stop();
  h.addMenu(); h.mutate(h.portal); h.interact(); h.advance(3000);
  assert.equal(h.entry(), null); assert.equal(h.timers.size, 0); assert.equal(h.observers.some(observer => observer.active), false);
  assert.deepEqual(h.controller.snapshot(), {active:false, hasMenu:false, hasEntry:false, discovering:false, sourceConnected:false, status:''});
});
