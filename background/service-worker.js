/**
 * LeetSync Service Worker (Background)
 * Manages GitHub syncing and auth token retrieval.
 * Token is read exclusively in this module and never logged.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetSync service worker installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PING') {
    sendResponse({ status: 'OK' });
  }
  return true;
});

