(() => {
  'use strict';
  TCCI18n.applyDocument(document);
  document.title = TCCI18n.message('extensionName');
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = TCCI18n.message(element.getAttribute('data-i18n'));
  const state = document.querySelector('#popup-state'), error = document.querySelector('#popup-error'), open = document.querySelector('#open-settings');
  let disposed = false, suspended = false, terminated = false, generation = 0, lifecycle = 0;
  function show(value) { state.textContent = TCCI18n.message(value === 1 ? 'popupEnabled' : 'popupDisabled'); }
  function changed(changes, area) {
    if (disposed || area !== 'local' || !Object.hasOwn(changes, 'tccConsentVersion')) return;
    generation += 1; error.textContent = ''; show(changes.tccConsentVersion.newValue);
  }
  chrome.storage.onChanged.addListener(changed);
  function read() {
    const initial = generation;
    try { chrome.storage.local.get('tccConsentVersion', result => {
      if (disposed || initial !== generation) return;
      show(chrome.runtime.lastError ? undefined : result?.tccConsentVersion);
      if (chrome.runtime.lastError) error.textContent = TCCI18n.message('consentSaveError');
    }); } catch { show(undefined); error.textContent = TCCI18n.message('consentSaveError'); }
  }
  open.addEventListener('click', async () => {
    if (disposed || open.disabled) return;
    open.disabled = true; error.textContent = ''; const request = lifecycle;
    try { await chrome.runtime.openOptionsPage(); if (!disposed && request === lifecycle) window.close(); }
    catch { if (!disposed && request === lifecycle) { open.disabled = false; error.textContent = TCCI18n.message('errorOpenSettings'); } }
  });
  window.addEventListener('pagehide', event => { disposed = true; suspended = event.persisted === true; terminated ||= !suspended; lifecycle += 1; generation += 1; chrome.storage.onChanged.removeListener(changed); });
  window.addEventListener('pageshow', event => { if (event.persisted && suspended && !terminated) { suspended = false; disposed = false; open.disabled = false; chrome.storage.onChanged.addListener(changed); read(); } });
  read();
})();
