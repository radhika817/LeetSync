/**
 * Content script running in LeetCode isolated world on problem pages.
 * - Injects scripts/inject.js into the main page DOM.
 * - Listens for window.postMessage from inject.js.
 * - Deduplicates submission IDs.
 * - Forwards detected submissions to background service worker.
 */

(function () {
  'use strict';

  console.log('LeetSync loaded');

  // Track forwarded submission IDs to prevent duplicate triggers
  const seenSubmissions = new Set();

  /**
   * Inject script tag into page main world
   * @param {string} filePath - relative path to extension asset
   */
  function injectMainWorldScript(filePath) {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(filePath);
      script.type = 'text/javascript';
      script.onload = () => {
        script.remove(); // Clean up DOM node once executed
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.error('[LeetSync] Error injecting script:', error.message);
    }
  }

  // Inject our network interceptor
  injectMainWorldScript('scripts/inject.js');

  // Listen for window postMessages from inject.js
  window.addEventListener('message', (event) => {
    // Only accept messages from the current window and identified source
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== 'leetsync' || data.type !== 'ACCEPTED') {
      return;
    }

    const submissionId = String(data.submissionId);

    // Deduplication check
    if (!submissionId || seenSubmissions.has(submissionId)) {
      return;
    }
    seenSubmissions.add(submissionId);

    const currentUrl = window.location.href;

    console.log(
      `[LeetSync] Forwarding Accepted submission #${submissionId} to background service worker (Problem URL: ${currentUrl})`
    );

    // Forward to service worker
    chrome.runtime.sendMessage(
      {
        action: 'SUBMISSION_ACCEPTED',
        payload: {
          submissionId: submissionId,
          url: currentUrl
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[LeetSync] Service worker response error:', chrome.runtime.lastError.message);
        } else if (response) {
          console.log('[LeetSync] Background worker received submission:', response);
        }
      }
    );
  });
})();
