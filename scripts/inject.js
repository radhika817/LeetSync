/**
 * scripts/inject.js
 * Runs in LeetCode's main page context.
 * Intercepts fetch and XMLHttpRequest to detect submission check responses.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__LEETSYNC_INJECTED__) {
    return;
  }
  window.__LEETSYNC_INJECTED__ = true;

  // Regex matching LeetCode submission check endpoint: /submissions/detail/{id}/check/
  const SUBMISSION_CHECK_REGEX = /\/submissions\/detail\/(\d+)\/check\//;

  /**
   * Helper to inspect parsed submission payload and dispatch postMessage
   * @param {string} url
   * @param {Object} data
   */
  function inspectSubmissionData(url, data) {
    try {
      const match = url.match(SUBMISSION_CHECK_REGEX);
      if (!match) return;

      const submissionId = match[1];

      // LeetCode polling returns state: "SUCCESS" and status_msg: "Accepted" when completed
      if (
        data &&
        typeof data === 'object' &&
        data.state === 'SUCCESS' &&
        data.status_msg === 'Accepted'
      ) {
        console.log(`[LeetSync] Accepted submission detected! ID: ${submissionId}`);

        window.postMessage(
          {
            source: 'leetsync',
            type: 'ACCEPTED',
            submissionId: submissionId
          },
          '*'
        );
      }
    } catch (err) {
      console.warn('[LeetSync] Error parsing submission check payload:', err.message);
    }
  }

  // 1) Wrap window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

      if (SUBMISSION_CHECK_REGEX.test(url)) {
        // Clone response so the page can still consume its body stream
        response
          .clone()
          .json()
          .then((data) => {
            inspectSubmissionData(url, data);
          })
          .catch(() => {});
      }
    } catch (error) {
      console.warn('[LeetSync] Fetch intercept error:', error.message);
    }

    return response;
  };

  // 2) Wrap XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._leetsyncUrl = typeof url === 'string' ? url : (url && url.toString()) || '';
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = this._leetsyncUrl || '';
        if (SUBMISSION_CHECK_REGEX.test(url)) {
          const responseText = this.responseText;
          if (responseText) {
            const data = JSON.parse(responseText);
            inspectSubmissionData(url, data);
          }
        }
      } catch (err) {
        // Ignored or invalid JSON
      }
    });

    return originalSend.apply(this, args);
  };

  console.log('[LeetSync] Submission interceptor initialized in page world.');
})();
