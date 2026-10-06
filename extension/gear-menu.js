/* Native settings-menu enhancement only. No native player action is invoked. */
(() => {
  'use strict';
  const MENU = '[data-a-target="player-settings-menu"]';
  const ROW = '[data-tcc-gear-row]';
  const DISCOVERY_MS = 2000;
  const SCAN_MS = 40;
  const normalize = text => String(text || '').replace(/\s+/g, ' ').trim();
  // Exact current Twitch labels; sources and gaps are documented in NATIVE-MENU-EVIDENCE.md.
  const NATIVE_LABELS = new Set(['ポップアウト','Popout Player','팝업 플레이어','弹出播放器','Reproductor emergente','Pop-out-Player','Ouvrir dans nouvelle fenêtre','Открыть в отдельном окне','مشغّل منبثق']);
  const nativeLabel = text => NATIVE_LABELS.has(normalize(text));

  function create({window: win, document: doc, onOpen, label: entryLabel, language = 'en', direction = 'ltr'}) {
    if (!win || !doc || typeof onOpen !== 'function' || typeof entryLabel !== 'string' || !entryLabel.trim()) throw new TypeError('A window, document, onOpen callback, and localized label are required.');
    const Observer = win.MutationObserver || globalThis.MutationObserver;
    const later = (win.setTimeout || globalThis.setTimeout).bind(win);
    const cancel = (win.clearTimeout || globalThis.clearTimeout).bind(win);
    let active = false, source = null, player = null, menu = null;
    let row = null, button = null, messageNode = null, status = '';
    let menuObserver = null, ancestorObserver = null, discovery = null;
    let discoveryTimer = 0, scanTimer = 0;

    function sourceValid() {
      return !!(source?.tagName === 'VIDEO' && source.isConnected && source.ownerDocument === doc);
    }
    function playerForSource() {
      const candidates = [source?.closest('[data-a-target="video-player"],.video-player'), source?.parentElement?.parentElement, source?.parentElement];
      return candidates.find(node => node && node !== doc.body && node !== doc.documentElement) || null;
    }
    function visible(element) {
      if (!element?.isConnected || element.ownerDocument !== doc) return false;
      for (let node = element; node; node = node.parentElement) {
        if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
        const style = win.getComputedStyle?.(node);
        if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    function findMenu() {
      const roots = [...doc.querySelectorAll(MENU)].filter(node => node.tagName === 'DIV' && node.isConnected);
      const shown = roots.filter(visible);
      if (shown.length === 1) return shown[0];
      // A single hidden menu is worth observing locally, but never enhancing.
      return shown.length === 0 && roots.length === 1 ? roots[0] : null;
    }
    function anchorFor(root) {
      if (!root || root.tagName !== 'DIV' || root.getAttribute('data-a-target') !== 'player-settings-menu' || !visible(root)) return null;
      const matches = [...root.querySelectorAll('button')].filter(node =>
        node.getAttribute('role') === 'menuitem' && nativeLabel(node.textContent) && visible(node));
      if (matches.length !== 1) return null;
      const anchor = matches[0], wrapper = anchor.parentElement;
      const flex = anchor.children[0], label = flex?.children[0];
      // This exact hierarchy is supported by the user's inspected Twitch DOM.
      // Unknown wrappers, icons, nested labels, or duplicate anchors fail closed.
      if (!wrapper || wrapper.tagName !== 'DIV' || wrapper.parentElement !== root || wrapper.children.length !== 1 ||
          anchor.children.length !== 1 || flex?.tagName !== 'DIV' || flex.children.length !== 1 ||
          label?.tagName !== 'DIV' || label.children.length !== 0 || !nativeLabel(label.textContent) ||
          anchor.disabled || anchor.getAttribute('aria-disabled') === 'true') return null;
      return {anchor, wrapper, flex, label};
    }
    function clearEntry() {
      button?.removeEventListener('click', open);
      row?.remove();
      row = button = messageNode = null;
    }
    function stopDiscovery() {
      discovery?.disconnect(); discovery = null;
      cancel(discoveryTimer); discoveryTimer = 0;
    }
    function schedule() {
      if (!active || scanTimer) return;
      scanTimer = later(() => { scanTimer = 0; refresh(); }, SCAN_MS);
    }
    function discover() {
      if (!active || discovery || menu || !Observer) return;
      discovery = new Observer(schedule);
      discovery.observe(doc.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['aria-hidden','hidden']});
      // Never extend this deadline in response to chat or other DOM mutations.
      discoveryTimer = later(stopDiscovery, DISCOVERY_MS);
    }
    function watchAncestors() {
      ancestorObserver?.disconnect(); ancestorObserver = null;
      if (!active || !Observer) return;
      ancestorObserver = new Observer(schedule);
      const targets = new Map();
      for (let node = source?.parentElement; node; node = node.parentElement) targets.set(node, false);
      for (let node = menu?.parentElement; node; node = node.parentElement) targets.set(node, true);
      // Direct-child observation detects a removed player/menu/ancestor without
      // observing the application's chat subtree indefinitely.
      for (const [target, menuAncestor] of targets) ancestorObserver.observe(target, menuAncestor
        ? {childList:true, attributes:true, attributeFilter:['aria-hidden','hidden']}
        : {childList:true});
    }
    function bindMenu(next) {
      if (menu === next) return;
      clearEntry(); menuObserver?.disconnect(); menuObserver = null;
      menu = next;
      if (menu) {
        stopDiscovery();
        if (Observer) {
          menuObserver = new Observer(schedule);
          menuObserver.observe(menu, {childList:true, subtree:true, characterData:true, attributes:true,
            attributeFilter:['class','role','data-a-target','aria-hidden','hidden','disabled','aria-disabled','style']});
        }
      }
      watchAncestors();
    }
    function copyClass(target, model) {
      const value = typeof model.className === 'string' ? model.className : '';
      if (target.className !== value) target.className = value;
    }
    function renderStatus() {
      if (!messageNode) return;
      if (messageNode.textContent !== status) messageNode.textContent = status;
      if (messageNode.hidden !== !status) messageNode.hidden = !status;
    }
    function open(event) {
      event.preventDefault(); event.stopPropagation();
      if (!active || !sourceValid() || !row?.isConnected || findMenu() !== menu || !anchorFor(menu)) return;
      // Keep this synchronous. requestWindow must run in this button's gesture.
      onOpen(event);
    }
    function enhance(parts) {
      // Remove only rows carrying this extension's private marker. Native rows
      // and their attributes, listeners, and actions are never modified.
      for (const duplicate of menu.querySelectorAll(ROW)) if (duplicate !== row) duplicate.remove();
      if (!row || row.parentElement !== menu) {
        clearEntry();
        row = doc.createElement('div'); row.setAttribute('data-tcc-gear-row', '');row.lang=language;row.dir=direction;
        button = doc.createElement('button'); button.type = 'button';
        button.setAttribute('role', 'menuitem'); button.setAttribute('data-tcc-gear-entry', '');
        button.setAttribute('aria-label', entryLabel);button.lang=language;button.dir=direction;
        const flex = doc.createElement('div'), label = doc.createElement('div');
        label.textContent = entryLabel; flex.append(label); button.append(flex);
        button.addEventListener('click', open);
        messageNode = doc.createElement('div'); messageNode.setAttribute('data-tcc-gear-status', '');
        messageNode.setAttribute('role', 'status'); messageNode.setAttribute('aria-live', 'polite');
        messageNode.style.cssText = 'font-size:12px;line-height:1.5;padding:4px 10px 8px;white-space:normal;';
        row.append(button, messageNode);
      }
      copyClass(row, parts.wrapper); copyClass(button, parts.anchor);
      copyClass(button.children[0], parts.flex); copyClass(button.children[0].children[0], parts.label);
      renderStatus();
      if (parts.wrapper.nextSibling !== row) menu.insertBefore(row, parts.wrapper.nextSibling);
    }
    function refresh() {
      if (!active) return;
      if (!sourceValid()) { stop(); return; }
      const nextPlayer = playerForSource();
      if (player !== nextPlayer) { player = nextPlayer; watchAncestors(); }
      const previous = menu, next = findMenu();
      bindMenu(next);
      const parts = anchorFor(menu);
      if (parts) enhance(parts); else clearEntry();
      // A removed/replaced menu gets one bounded recovery pass. An unsuccessful
      // pass waits for a fresh player interaction, rather than restarting itself.
      if (previous && !next) discover();
    }
    function interaction(event) {
      if (!active || !sourceValid()) { if (active) stop(); return; }
      if (event.type === 'keydown' && !['Enter',' ','Spacebar'].includes(event.key)) return;
      const target = event.target?.closest?.('button');
      if (!target || target === button || !(player?.contains(target) || menu?.contains(target))) return;
      // Read the player interaction only. Do not guess Twitch's gear selector,
      // alter key handling, or invoke any native controls.
      refresh(); discover(); schedule();
    }
    function stop() {
      active = false;
      doc.removeEventListener('click', interaction, true);
      doc.removeEventListener('keydown', interaction, true);
      stopDiscovery(); cancel(scanTimer); scanTimer = 0;
      menuObserver?.disconnect(); menuObserver = null;
      ancestorObserver?.disconnect(); ancestorObserver = null;
      clearEntry(); menu = source = player = null;
    }
    function start(sourceVideo) {
      if (active && source === sourceVideo) { refresh(); return; }
      stop(); source = sourceVideo;
      if (!sourceValid()) { source = null; return; }
      player = playerForSource();
      active = true;
      doc.addEventListener('click', interaction, true);
      doc.addEventListener('keydown', interaction, true);
      watchAncestors(); refresh(); discover();
    }
    return Object.freeze({start, stop, refresh,
      setStatus(message) { status = String(message || ''); renderStatus(); },
      snapshot() { return {active, hasMenu:!!menu, hasEntry:!!row?.isConnected, discovering:!!discovery, sourceConnected:sourceValid(), status}; }
    });
  }
  const api = Object.freeze({create});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.TCCGearMenu = api;
})();
