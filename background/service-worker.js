/**
 * LeetSync Service Worker (Background)
 * Coordinates GitHub sync operations and authentication.
 * Token is read exclusively in this module and never logged or exposed.
 */

import { getStorage, setStorage, STORAGE_KEYS } from '../utils/storage.js';
import { verifyRepo } from '../utils/github.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetSync service worker installed.');
});

// Message listener for popup & content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'VERIFY_GITHUB') {
    handleVerifyGithub(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'SUBMISSION_ACCEPTED') {
    const { submission, url } = message.payload || {};
    if (submission) {
      console.log(
        `[LeetSync Service Worker] Received submission for "${submission.number}. ${submission.title}" (${submission.language}${submission.extension}) from ${url}`
      );
    }
    sendResponse({ ok: true, received: submission?.id });
    return true;
  }

  if (message.action === 'PING') {
    sendResponse({ ok: true, status: 'PONG' });
    return true;
  }

  return false;
});

/**
 * Verifies repository access and saves verified config securely
 * @param {Object} payload - { token, owner, repo, branch }
 * @returns {Promise<Object>}
 */
async function handleVerifyGithub(payload) {
  try {
    const { token, owner, repo, branch } = payload;

    // Use provided token or fallback to currently stored token if unchanged
    let activeToken = token;
    if (!activeToken) {
      const stored = await getStorage(STORAGE_KEYS.GITHUB_TOKEN);
      activeToken = stored[STORAGE_KEYS.GITHUB_TOKEN];
    }

    if (!activeToken) {
      return { ok: false, error: 'No GitHub token provided or stored.' };
    }

    const repoData = await verifyRepo(activeToken, owner, repo);

    // Save verified configuration
    const updates = {
      [STORAGE_KEYS.REPO_OWNER]: owner.trim(),
      [STORAGE_KEYS.REPO_NAME]: repo.trim(),
      [STORAGE_KEYS.BRANCH]: (branch || 'main').trim()
    };

    if (token) {
      updates[STORAGE_KEYS.GITHUB_TOKEN] = token.trim();
    }

    await setStorage(updates);

    return {
      ok: true,
      data: repoData
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
