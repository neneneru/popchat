/* All translations are packaged locally and resolved by the browser. */
(() => {
  'use strict';
  const message = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);
  const language = (message('@@ui_locale') || 'en').replaceAll('_', '-');
  const direction = message('@@bidi_dir') === 'rtl' ? 'rtl' : 'ltr';
  function applyDocument(doc) {
    doc.documentElement.lang = language;
    doc.documentElement.dir = direction;
  }
  globalThis.TCCI18n = Object.freeze({message, language, direction, applyDocument});
})();
