(() => {
  'use strict';
  TCCI18n.applyDocument(document);
  document.title = TCCI18n.message('extensionName');
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = TCCI18n.message(element.getAttribute('data-i18n'));
  document.querySelector('#version').textContent = chrome.runtime.getManifest().version;
  const prompt = document.querySelector('#consent-prompt'), active = document.querySelector('#consent-active');
  const status = document.querySelector('#consent-status');
  const enable = document.querySelector('#consent-enable'), disable = document.querySelector('#consent-disable'), later = document.querySelector('#consent-later');
  let generation = 0, disposed = false, suspended = false, terminated = false, writing = false, writeSequence = 0;
  function busy(value) { enable.disabled = disable.disabled = later.disabled = value; }
  function show(value) { prompt.hidden = value === 1; active.hidden = value !== 1; busy(writing); }
  function failed() { status.textContent = TCCI18n.message('consentSaveError'); }
  function changed(changes, area) {
    if (disposed || area !== 'local' || !Object.hasOwn(changes, 'tccConsentVersion')) return;
    generation += 1; status.textContent = ''; show(changes.tccConsentVersion.newValue);
  }
  function read() {
    const request = generation; busy(true);
    try { chrome.storage.local.get('tccConsentVersion', result => {
      if (disposed || request !== generation) return;
      show(chrome.runtime.lastError ? undefined : result?.tccConsentVersion);
      if (chrome.runtime.lastError) failed();
    }); } catch { show(undefined); failed(); }
  }
  function save(value) {
    if (disposed || writing || enable.disabled || disable.disabled) return;
    writing = true;
    const operation = ++writeSequence, request = ++generation; status.textContent = ''; busy(true);
    try { chrome.storage.local.set({tccConsentVersion:value}, () => {
      if (disposed || operation !== writeSequence) return;
      writing = false; busy(false);
      if (chrome.runtime.lastError) { failed(); return; }
      if (request === generation) show(value);
    }); } catch { writing = false; if (!disposed) { busy(false); failed(); } }
  }
  enable.addEventListener('click', () => save(1));
  disable.addEventListener('click', () => save(0));
  later.addEventListener('click', () => { if (!disposed && !writing && !later.disabled) status.textContent = TCCI18n.message('consentDeferred'); });
  chrome.storage.onChanged.addListener(changed);
  window.addEventListener('pagehide', event => { disposed = true; suspended = event.persisted === true; terminated ||= !suspended; writing = false; writeSequence += 1; generation += 1; chrome.storage.onChanged.removeListener(changed); });
  window.addEventListener('pageshow', event => { if(event.persisted && suspended && !terminated){ suspended = false; disposed = false; chrome.storage.onChanged.addListener(changed); read(); } });
  read();
})();
