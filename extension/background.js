/* Open the local setup page once on installation; never on update/startup. */
'use strict';
let opening = null;
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason !== 'install' || opening) return;
  try {
    opening = Promise.resolve(chrome.runtime.openOptionsPage()).catch(() => {
      // The same page remains available from the extension action or Options.
    }).finally(() => { opening = null; });
  } catch { opening = null; }
});
