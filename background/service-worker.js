/**
 * LeetSync Service Worker (Background)
 * Coordinates GitHub sync operations and authentication.
 * Token is read exclusively in this module and never logged or exposed.
 */

import {
  getStorage,
  setStorage,
  addSyncHistoryEntry,
  STORAGE_KEYS,
  DEFAULT_SETTINGS
} from '../utils/storage.js';
import { verifyRepo, getFile, putFile } from '../utils/github.js';
import {
  buildSubmissionPath,
  formatLanguageDisplay
} from '../utils/leetcode.js';

// In-memory lock to guard against concurrent syncs of the same file path
const activeSyncLocks = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetSync service worker installed.');
});

// Message listener for popup & content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender originates from our own extension
  if (sender.id !== chrome.runtime.id) {
    console.warn('[LeetSync Service Worker] Rejected message from unauthorized sender:', sender.id);
    return false;
  }

  if (message.action === 'VERIFY_GITHUB') {
    handleVerifyGithub(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'SUBMISSION_ACCEPTED') {
    // Ensure submission syncs only originate from leetcode.com problem tabs
    if (!sender.tab || !sender.tab.url || !sender.tab.url.startsWith('https://leetcode.com/problems/')) {
      sendResponse({ ok: false, error: 'Unauthorized submission source tab.' });
      return false;
    }

    const { submission, url } = message.payload || {};
    handleSyncSubmission(submission, url)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.error('[LeetSync Service Worker] Sync error:', err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (message.action === 'PING') {
    sendResponse({ ok: true, status: 'PONG' });
    return true;
  }

  return false;
});

/**
 * Handles the complete sync flow for an accepted submission:
 * 1. Validate submission payload
 * 2. Load stored GitHub credentials & settings
 * 3. Guard against concurrent syncs of the same file
 * 4. Duplicate handling:
 *    - If content is identical -> skip commit and notify "Already synced"
 *    - If content differs:
 *      * 'update'  -> update existing file using sha and "Update:" message
 *      * 'skip'    -> skip commit and notify "Different code already exists; skipped"
 *      * 'version' -> find next available version (e.g. Two-Sum_v2.cpp) and commit with "Add: ..."
 * 5. Commit file to GitHub via utils/github.js
 * 6. Display Chrome notification and append to sync history (max 50)
 *
 * @param {Object} submission
 * @param {string} problemUrl
 * @returns {Promise<Object>}
 */
async function handleSyncSubmission(submission, problemUrl) {
  if (!submission || !submission.code || !submission.title) {
    const errorMsg = 'Invalid submission data: missing code or title.';
    showSyncNotification(false, 'Validation Failed', errorMsg);
    throw new Error(errorMsg);
  }

  // Load GitHub credentials and settings from storage
  const config = await getStorage([
    STORAGE_KEYS.GITHUB_TOKEN,
    STORAGE_KEYS.REPO_OWNER,
    STORAGE_KEYS.REPO_NAME,
    STORAGE_KEYS.BRANCH,
    STORAGE_KEYS.SETTINGS
  ]);

  const token = config[STORAGE_KEYS.GITHUB_TOKEN];
  const owner = config[STORAGE_KEYS.REPO_OWNER];
  const repo = config[STORAGE_KEYS.REPO_NAME];
  const branch = config[STORAGE_KEYS.BRANCH] || 'main';
  const settings = { ...DEFAULT_SETTINGS, ...(config[STORAGE_KEYS.SETTINGS] || {}) };
  const duplicateStrategy = settings.duplicateStrategy || 'update'; // 'update' | 'skip' | 'version'

  if (!token || !owner || !repo) {
    const errorMsg = 'GitHub repository is not configured. Please open LeetSync popup and connect your repo.';
    showSyncNotification(false, 'Not Connected to GitHub', errorMsg);
    throw new Error(errorMsg);
  }

  const langDisplay = formatLanguageDisplay(submission.language);
  const problemName = `${submission.number ? submission.number + '. ' : ''}${submission.title}`;

  // Initial target file path
  let targetPath = buildSubmissionPath(submission, settings);
  const lockKey = `${owner}/${repo}:${branch}:${targetPath}`;

  // Guard against concurrent syncs of the exact same target file
  if (activeSyncLocks.has(lockKey)) {
    console.warn(`[LeetSync Service Worker] Sync for "${targetPath}" is already in progress. Skipping concurrent request.`);
    return { ok: false, error: 'A sync for this problem is already in progress.' };
  }

  activeSyncLocks.add(lockKey);

  try {
    console.log(`[LeetSync Service Worker] Checking existing file for "${problemName}" at "${targetPath}"...`);

    // Check if the base file already exists on GitHub
    const existingFile = await getFile(token, owner, repo, targetPath, branch);
    let targetSha = existingFile?.sha;
    let actionPrefix = 'Add';

    if (existingFile && existingFile.sha) {
      // 1) Identical content check
      if (existingFile.content === submission.code) {
        console.log(`[LeetSync Service Worker] Solution at "${targetPath}" is identical. Skipping commit.`);
        showSyncNotification(
          true,
          'Already Synced',
          `"${problemName}" (${langDisplay}) is identical to the solution on GitHub.`
        );
        await recordSyncHistory({
          submissionId: submission.id,
          problemTitle: problemName,
          language: langDisplay,
          status: 'ALREADY_SYNCED',
          path: targetPath,
          commitUrl: null
        });
        return { ok: true, status: 'ALREADY_SYNCED', path: targetPath };
      }

      // 2) Content differs -> apply duplicateStrategy
      console.log(`[LeetSync Service Worker] File exists but differs. Applying strategy: "${duplicateStrategy}"`);

      if (duplicateStrategy === 'skip') {
        showSyncNotification(
          true,
          'Skipped Existing Solution',
          `"${problemName}" has existing solution with different code. Commit skipped.`
        );
        await recordSyncHistory({
          submissionId: submission.id,
          problemTitle: problemName,
          language: langDisplay,
          status: 'SKIPPED',
          path: targetPath,
          commitUrl: null
        });
        return { ok: true, status: 'SKIPPED', path: targetPath };
      } else if (duplicateStrategy === 'version') {
        // Find next available version number (e.g., Two-Sum_v2.cpp, Two-Sum_v3.cpp...)
        let version = 2;
        let versionedPath = buildSubmissionPath(submission, settings, version);
        let versionFile = await getFile(token, owner, repo, versionedPath, branch);

        while (versionFile && versionFile.sha) {
          if (versionFile.content === submission.code) {
            // Found a version that is already identical!
            showSyncNotification(
              true,
              'Already Synced',
              `"${problemName}" matches existing version ${version}.`
            );
            await recordSyncHistory({
              submissionId: submission.id,
              problemTitle: `${problemName} (v${version})`,
              language: langDisplay,
              status: 'ALREADY_SYNCED',
              path: versionedPath,
              commitUrl: null
            });
            return { ok: true, status: 'ALREADY_SYNCED', path: versionedPath };
          }
          version++;
          versionedPath = buildSubmissionPath(submission, settings, version);
          versionFile = await getFile(token, owner, repo, versionedPath, branch);
        }

        // New version found
        targetPath = versionedPath;
        targetSha = undefined; // New file
        actionPrefix = `Add (v${version})`;
      } else {
        // 'update' strategy (default)
        actionPrefix = 'Update';
      }
    }

    // Prepare commit message
    const commitMessage = `${actionPrefix}: ${problemName} (${langDisplay})`;

    // Upload / Commit file to GitHub
    const result = await putFile(token, owner, repo, {
      path: targetPath,
      content: submission.code,
      message: commitMessage,
      sha: targetSha,
      branch: branch
    });

    console.log(`[LeetSync Service Worker] Successfully synced! Commit: ${result.commitSha}`);

    // Desktop notification
    showSyncNotification(
      true,
      `Synced to GitHub! (${actionPrefix})`,
      `${problemName} (${langDisplay}) \u2192 ${targetPath}`
    );

    // Save in storage sync history
    await recordSyncHistory({
      submissionId: submission.id,
      problemTitle: problemName,
      language: langDisplay,
      status: 'SUCCESS',
      path: targetPath,
      commitUrl: result.htmlUrl || `https://github.com/${owner}/${repo}/blob/${branch}/${targetPath}`,
      action: actionPrefix
    });

    return {
      ok: true,
      status: 'SUCCESS',
      path: targetPath,
      commitSha: result.commitSha
    };
  } catch (error) {
    const errorMsg = error.message || 'Unknown GitHub API error';
    console.error(`[LeetSync Service Worker] Sync failed for "${targetPath}":`, errorMsg);

    showSyncNotification(
      false,
      'Sync Failed',
      `Could not sync "${problemName}": ${errorMsg}`
    );

    await recordSyncHistory({
      submissionId: submission.id,
      problemTitle: problemName,
      language: langDisplay,
      status: 'FAILED',
      path: targetPath,
      error: errorMsg
    });

    throw error;
  } finally {
    // Release in-memory lock
    activeSyncLocks.delete(lockKey);
  }
}

/**
 * Appends entry to sync history (capped at 50)
 * @param {Object} details
 */
async function recordSyncHistory(details) {
  try {
    await addSyncHistoryEntry(
      {
        id: details.submissionId || Date.now().toString(),
        problemTitle: details.problemTitle,
        language: details.language,
        status: details.status,
        path: details.path,
        commitUrl: details.commitUrl || null,
        error: details.error || null,
        timestamp: Date.now()
      },
      50
    );
  } catch (err) {
    console.warn('[LeetSync Service Worker] Could not record sync history:', err.message);
  }
}

/**
 * Sets badge text and background on extension action icon and clears after 4 seconds
 * @param {boolean} isSuccess
 */
function setExtensionBadge(isSuccess) {
  try {
    const text = isSuccess ? '\u2713' : '!';
    const color = isSuccess ? '#3fb950' : '#f85149';

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });

    // Auto-clear badge after 4.5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 4500);
  } catch (err) {
    console.warn('[LeetSync Service Worker] Badge error:', err.message);
  }
}

/**
 * Displays a Chrome notification to the user
 * @param {boolean} isSuccess
 * @param {string} title
 * @param {string} message
 */
function showSyncNotification(isSuccess, title, message) {
  // Update action icon badge
  setExtensionBadge(isSuccess);

  try {
    chrome.notifications.create(
      `leetsync-${Date.now()}`,
      {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
        title: title,
        message: message,
        priority: 2
      },
      (notificationId) => {
        if (chrome.runtime.lastError) {
          console.warn('[LeetSync Service Worker] Notification error:', chrome.runtime.lastError.message);
        }
      }
    );
  } catch (error) {
    console.warn('[LeetSync Service Worker] Failed to create notification:', error.message);
  }
}

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
