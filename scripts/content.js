/**
 * Content script running in LeetCode isolated world on problem pages.
 * - Injects scripts/inject.js into the main page DOM.
 * - Listens for window.postMessage from inject.js.
 * - Deduplicates submission IDs.
 * - Fetches full submission details via LeetCode GraphQL using cookies/credentials.
 * - Forwards validated normalized submission to background service worker.
 */

(async function () {
  'use strict';

  console.log('LeetSync loaded');

  // Dynamic import of leetcode.js utility inside content script
  let leetcodeUtil;
  try {
    const utilUrl = chrome.runtime.getURL('utils/leetcode.js');
    leetcodeUtil = await import(utilUrl);
  } catch (err) {
    console.error('[LeetSync] Failed to load leetcode.js utility:', err.message);
  }

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
  window.addEventListener('message', async (event) => {
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

    console.log(`[LeetSync] Processing Accepted submission #${submissionId}...`);

    try {
      if (!leetcodeUtil || !leetcodeUtil.fetchSubmissionDetails) {
        throw new Error('LeetCode utility module is not ready.');
      }

      // Fetch full details via GraphQL with user cookies
      const normalizedSubmission = await leetcodeUtil.fetchSubmissionDetails(submissionId);

      console.log(
        `[LeetSync] Successfully fetched submission details: "${normalizedSubmission.number}. ${normalizedSubmission.title}" (${normalizedSubmission.language})`
      );

      // Forward normalized submission to background service worker
      chrome.runtime.sendMessage(
        {
          action: 'SUBMISSION_ACCEPTED',
          payload: {
            submission: normalizedSubmission,
            url: window.location.href
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[LeetSync] Background service worker error:', chrome.runtime.lastError.message);
          } else if (response) {
            console.log('[LeetSync] Background worker status:', response);
          }
        }
      );
    } catch (error) {
      console.error(`[LeetSync] Failed to process submission #${submissionId}:`, error.message);
    }
  });
})();
