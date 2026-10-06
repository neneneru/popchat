(() => {
  'use strict';
  if (window.top !== window || globalThis.__tccStarted) return;
  globalThis.__tccStarted = true;
  const Core = TCCCore;
  const I18n = TCCI18n;
  const t = I18n.message;
  const UI = TCCUI;
  let preferences = {...Core.DEFAULTS}, preferencesLoaded = false;
  const earlyPreferenceChanges = new Set();
  let route = null, popout = null, pip = null, gear = null;
  let discovery = null, discoveryTimer = 0, reconcileTimer = 0, savingTimer = 0, navigationTimer = 0;
  let opening = false, disposed = false, suspended = false, lifecycleVersion = 0;
  let consentEnabled = false, consentGeneration = 0;
  const supportsPip = () => typeof window.documentPictureInPicture?.requestWindow === 'function';
  const life = new AbortController();
  const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, {...options, signal: life.signal});

  // Store layout only. No channel, message, history, token, or user identifier.
  function save() {
    clearTimeout(savingTimer);
    if (!consentEnabled || !preferencesLoaded || disposed || suspended) return;
    savingTimer = setTimeout(() => {
      try { chrome.storage.local.set({tccPreferences: preferences}, () => void chrome.runtime.lastError); } catch { /* extension was reloaded */ }
    }, 300);
  }
  function setConsent(value) {
    const enabled = value === 1;
    if (disposed || enabled === consentEnabled) return;
    consentEnabled = enabled; lifecycleVersion += 1;
    if (enabled) { reconcile(); return; }
    gear?.stop(); stopDiscovery();
    clearTimeout(reconcileTimer); reconcileTimer = 0;
    clearTimeout(savingTimer); savingTimer = 0;
    clearTimeout(navigationTimer); navigationTimer = 0;
    finishPip(true); unmountPopout(); route = null;
  }
  function storageChanged(changes, area) {
    if (area !== 'local' || !Object.hasOwn(changes, 'tccConsentVersion')) return;
    consentGeneration += 1;
    setConsent(changes.tccConsentVersion.newValue);
  }
  try {
    chrome.storage.onChanged.addListener(storageChanged);
    const generation = consentGeneration;
    chrome.storage.local.get(['tccPreferences','tccConsentVersion'], (result) => {
      if (chrome.runtime.lastError || disposed) return;
      const stored = Core.settings(result?.tccPreferences);
      for (const key of Object.keys(stored)) if (!earlyPreferenceChanges.has(key)) preferences[key] = stored[key];
      preferencesLoaded = true;
      if (generation === consentGeneration) setConsent(result?.tccConsentVersion);
      resize();
      if (earlyPreferenceChanges.size) save();
      earlyPreferenceChanges.clear();
    });
  } catch { /* Missing or unreadable consent leaves the extension inactive. */ }
  function setMode(value) { if (!consentEnabled || disposed || suspended) return; if (!preferencesLoaded) earlyPreferenceChanges.add('mode'); preferences.mode = Core.settings({mode:value}).mode; save(); resize(); }
  function currentVideo() {
    const videos = [...document.querySelectorAll('video')].filter(v => v.isConnected && !v.closest('#tcc-placeholder'));
    return videos.sort((a,b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0] || null;
  }
  function playerRoot(video) {
    // Twitch-specific selectors are optional hints. The direct app body-child is stable for popouts.
    let node = video;
    while (node?.parentElement && node.parentElement !== document.body) node = node.parentElement;
    return node && node !== document.body && node !== document.documentElement ? node : null;
  }
  function stopDiscovery() { discovery?.disconnect(); discovery = null; clearTimeout(discoveryTimer); }
  function discover() {
    if (discovery || disposed || suspended || !consentEnabled) return;
    discovery = new MutationObserver(() => { scheduleReconcile(); });
    discovery.observe(document.body, {childList:true, subtree:true});
    // Startup-only observation: never watch every chat mutation indefinitely.
    discoveryTimer = setTimeout(stopDiscovery, 10000);
  }
  function scheduleReconcile() {
    if (reconcileTimer || disposed || suspended || !consentEnabled) return;
    reconcileTimer = setTimeout(() => { reconcileTimer = 0; reconcile(); }, 150);
  }
  function announce(text) { if (pip) pip.panel.status(text); else if(popout)popout.panel.status(text);else gear?.setStatus(text); }
  function openChatWindow() {
    if (!consentEnabled || !route) return;
    const context = pip?.window || window;
    const child = context.open(Core.chatPopoutURL(route.channel), '_blank', 'popup,width=400,height=680');
    if (child) { try { child.opener = null; } catch {} }
    else announce(t('errorPopupBlocked'));
  }
  function resize() {
    if (popout) {
      const value = Core.layout(preferences.mode, window.innerWidth, window.innerHeight);
      popout.panel.setMode(preferences.mode); popout.panel.setLayout(value);
      popout.root.style.setProperty('--tcc-player-width', value.mode === 'side' ? `max(0px, calc(100vw - ${value.chat}px))` : '100vw');
      popout.root.style.setProperty('--tcc-player-height', value.mode === 'bottom' ? `max(0px, calc(100vh - ${Core.HEADER_HEIGHT + value.chat}px))` : `calc(100vh - ${Core.HEADER_HEIGHT}px)`);
    }
    if (pip && !pip.window.closed) {
      pip.panel.setMode(preferences.mode);
      pip.panel.setLayout(Core.layout(preferences.mode, pip.window.innerWidth, pip.window.innerHeight));
    }
  }
  function unmountPopout() {
    if (!popout) return;
    const old = popout; popout = null; old.panel.destroy();document.documentElement.removeAttribute('data-tcc-popout-active');
    old.root.removeAttribute('data-tcc-player-root');
    for (const key of ['--tcc-player-width','--tcc-player-height']) {
      const prev = old.variables[key];
      if (prev.value) old.root.style.setProperty(key, prev.value, prev.priority); else old.root.style.removeProperty(key);
    }
  }
  function mountPopout(video) {
    const root = playerRoot(video); if (!root) return;
    if (popout?.root === root) return;
    unmountPopout();
    const variables = Object.fromEntries(['--tcc-player-width','--tcc-player-height'].map(key => [key,{value:root.style.getPropertyValue(key),priority:root.style.getPropertyPriority(key)}]));
    root.setAttribute('data-tcc-player-root', '');document.documentElement.setAttribute('data-tcc-popout-active','');
    const panel = UI.makePanel({doc:document, ...route, mode:preferences.mode, onMode:setMode, onChatWindow:openChatWindow,native:true});
    document.body.append(panel.host); popout={root,panel,variables};resize();
  }
  function restoreVideo(state) {
    const {video, marker, originalParent, originalNext, style, controls} = state;
    const replacement = (state.scope || originalParent).querySelector?.('video');
    if (replacement && replacement !== video) { video.pause(); video.remove(); marker.remove(); }
    else if (marker.isConnected) marker.replaceWith(video);
    else if (originalParent.isConnected) originalParent.insertBefore(video, originalNext?.parentNode === originalParent ? originalNext : null);
    else { video.pause(); video.remove(); }
    if (style === null) video.removeAttribute('style'); else video.setAttribute('style',style);
    video.controls = controls;
  }
  function finishPip(closeWindow = false, message = '') {
    if (!pip) return;
    const state = pip; pip = null;
    state.observer?.disconnect(); state.abort.abort();
    if (!preferencesLoaded) { earlyPreferenceChanges.add('width'); earlyPreferenceChanges.add('height'); }
    preferences = Core.settings({...preferences,width:state.width,height:state.height}); save();
    restoreVideo(state); state.panel.destroy();
    if (closeWindow && !state.window.closed) state.window.close();
    if (message) announce(message);
    scheduleReconcile();
  }
  async function openPip() {
    if (!consentEnabled || disposed || suspended) return;
    if (pip && !pip.window.closed) { pip.window.focus(); return; }
    const actual=Core.parseLocation(location.href);
    if (opening || !route || route.popout || !actual || actual.popout || actual.channel!==route.channel) return;
    gear?.setStatus('');
    const video = currentVideo();
    if (!video) {announce(t('errorVideoMissing'));return;}
    if (!window.documentPictureInPicture?.requestWindow) {
      announce(t('errorPipUnsupported')); return;
    }
    opening=true;
    const requestVersion=lifecycleVersion;
    let pipWindow;
    const startingChannel=route.channel;
    try {
      // This is intentionally the FIRST asynchronous operation: transient user activation is required.
      pipWindow = await window.documentPictureInPicture.requestWindow({width:preferences.width,height:preferences.height});
      if (!consentEnabled || disposed || requestVersion!==lifecycleVersion || route?.popout || Core.parseLocation(location.href)?.popout || route?.channel !== startingChannel || Core.parseLocation(location.href)?.channel !== startingChannel || !video.isConnected) {pipWindow.close();return;}
      const doc=pipWindow.document; doc.title=t('pipWindowTitle',[route.channel]); I18n.applyDocument(doc);
      doc.documentElement.style.overflow='hidden';doc.body.style.cssText='margin:0;overflow:hidden;background:#000;';
      const abort=new AbortController();
      const originalParent=video.parentNode, originalNext=video.nextSibling;
      const scope=originalParent.closest('[data-a-target="video-player"],.video-player') || originalParent.parentElement || originalParent;
      const marker=UI.element(document,'div','', t('pipPlaceholder'));
      marker.id='tcc-placeholder';marker.lang=I18n.language;marker.dir=I18n.direction; marker.style.cssText='display:flex;align-items:center;justify-content:center;min-height:100px;height:100%;padding:16px;background:#111;color:#e8e1f5;font:14px system-ui;text-align:center;';
      const state={window:pipWindow,video,marker,originalParent,originalNext,scope,style:video.getAttribute('style'),controls:video.controls,abort,width:pipWindow.innerWidth,height:pipWindow.innerHeight,observer:null,panel:null};
      doc.addEventListener('securitypolicyviolation',securityViolation,{signal:abort.signal});
      const panel=UI.makePanel({doc,...route,mode:preferences.mode,onMode:setMode,onChatWindow:openChatWindow});
      state.panel=panel; pip=state;
      doc.body.append(panel.host);
      pipWindow.addEventListener('pagehide',()=>finishPip(false),{once:true,signal:abort.signal});
      originalParent.insertBefore(marker, video);
      panel.video.append(video); // Reuse the one existing decoder; never clone or re-encode.
      video.controls=true;
      video.style.cssText='position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;margin:0!important;display:block!important;';
      resize();
      pipWindow.addEventListener('resize',()=>{
        if (!pip) return; state.width=pipWindow.innerWidth;state.height=pipWindow.innerHeight;resize();
      },{signal:abort.signal});
      // Watch only the original player subtree while detached, not the full chat/application DOM.
      state.observer=new MutationObserver((records)=>{
        if (pip!==state) return;
        const replaced=!marker.isConnected || records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1 && (node.tagName==='VIDEO'||node.querySelector?.('video'))));
        if (replaced) finishPip(true,t('statusPlayerReplaced'));
      });
      state.observer.observe(scope,{childList:true,subtree:true});
    } catch(error) {
      if (pip) finishPip(true);
      else if (pipWindow && !pipWindow.closed) pipWindow.close();
      announce(t('errorPipOpen'));
      console.warn('[PopChat for Twitch] Document PiP unavailable:', error?.name || 'Error');
    } finally {opening=false;}
  }
  function reconcile() {
    if (disposed || suspended || !consentEnabled) return;
    const next=Core.parseLocation(location.href);
    if (route?.channel!==next?.channel || route?.popout!==next?.popout) {
      lifecycleVersion+=1;gear?.stop();finishPip(true);unmountPopout();stopDiscovery();route=next;
    }
    if (!route) return;
    if (pip) {
      if (!pip.marker.isConnected) finishPip(true,t('statusPageUpdated'));
      else return;
    }
    const video=currentVideo();
    if (!video) {gear?.stop();discover();return;}
    stopDiscovery();
    if (route.popout) {gear?.stop();mountPopout(video);}
    else if(supportsPip())gear?.start(video);
    else gear?.stop();
  }
  gear=TCCGearMenu.create({window,document,onOpen:openPip,label:t('gearEntry'),language:I18n.language,direction:I18n.direction});
  listen(window,'resize',resize);
  listen(window,'popstate',scheduleReconcile);
  listen(window,'focus',scheduleReconcile);
  listen(document,'loadedmetadata',scheduleReconcile,{capture:true});
  listen(document,'playing',scheduleReconcile,{capture:true});
  // Navigation API sees Twitch's SPA pushState without patching its history functions.
  if (window.navigation) listen(window.navigation,'navigatesuccess',scheduleReconcile);
  else listen(document,'click',event=>{
    if(consentEnabled && !disposed && !suspended && event.target?.closest?.('a[href]')){
      clearTimeout(navigationTimer);navigationTimer=setTimeout(()=>{navigationTimer=0;scheduleReconcile();},500);
    }
  },{capture:true});
  function securityViolation(event) {
    if (!consentEnabled || disposed || suspended) return;
    if ((event.effectiveDirective === 'frame-src' || /^(frame-src|child-src|default-src)/.test(event.violatedDirective || '')) && event.blockedURI?.includes('twitch.tv')) {
      (pip?.panel || popout?.panel)?.status(t('errorChatEmbed'));
    }
  }
  listen(document,'securitypolicyviolation',securityViolation);
  listen(window,'pagehide',event=>{
    suspended=true;clearTimeout(navigationTimer);navigationTimer=0;
    lifecycleVersion+=1;gear?.stop();stopDiscovery();clearTimeout(reconcileTimer);reconcileTimer=0;finishPip(true);unmountPopout();
    clearTimeout(savingTimer);
    if (consentEnabled && preferencesLoaded) try { chrome.storage.local.set({tccPreferences:preferences},()=>void chrome.runtime.lastError); } catch {}
    if (!event.persisted) { disposed=true;life.abort();try {chrome.storage.onChanged.removeListener(storageChanged);} catch {} }
  });
  listen(window,'pageshow',event=>{if(event.persisted){suspended=false;reconcile();}});
  reconcile();
})();
