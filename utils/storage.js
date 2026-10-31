/**
 * Storage utility functions for LeetSync
 * Promise-based wrappers around chrome.storage.local
 */

export const STORAGE_KEYS = {
  GITHUB_TOKEN: 'githubToken',
  REPO_OWNER: 'repoOwner',
  REPO_NAME: 'repoName',
  BRANCH: 'branch',
  SETTINGS: 'settings',
  SYNC_HISTORY: 'syncHistory'
};

export const DEFAULT_SETTINGS = {
  groupByLanguage: true,
  groupByTopic: true,
  commitMessageTemplate: 'Solve {problem} ({difficulty}) [{language}]',
  duplicateStrategy: 'update' // 'update' | 'skip' | 'version'
};

/**
 * Retrieve items from chrome.storage.local
 * @param {string|string[]|Object} keys
 * @returns {Promise<Object>}
 */
export async function getStorage(keys) {
  try {
    return await chrome.storage.local.get(keys);
  } catch (error) {
    throw new Error(`Storage read error: ${error.message}`);
  }
}

/**
 * Set items into chrome.storage.local
 * @param {Object} items
 * @returns {Promise<void>}
 */
export async function setStorage(items) {
  try {
    await chrome.storage.local.set(items);
  } catch (error) {
    throw new Error(`Storage write error: ${error.message}`);
  }
}

/**
 * Append an entry to the sync history (keeps latest maxEntries)
 * @param {Object} entry - { id, problemTitle, language, timestamp, status, commitUrl }
 * @param {number} maxEntries - default 20
 * @returns {Promise<void>}
 */
export async function addSyncHistoryEntry(entry, maxEntries = 50) {
  try {
    const data = await getStorage(STORAGE_KEYS.SYNC_HISTORY);
    const history = Array.isArray(data[STORAGE_KEYS.SYNC_HISTORY]) ? data[STORAGE_KEYS.SYNC_HISTORY] : [];
    history.unshift(entry);
    if (history.length > maxEntries) {
      history.length = maxEntries;
    }
    await setStorage({ [STORAGE_KEYS.SYNC_HISTORY]: history });
  } catch (error) {
    throw new Error(`Failed to update sync history: ${error.message}`);
  }
}

/**
 * Get the latest sync history records
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getSyncHistory(limit = 5) {
  try {
    const data = await getStorage(STORAGE_KEYS.SYNC_HISTORY);
    const history = Array.isArray(data[STORAGE_KEYS.SYNC_HISTORY]) ? data[STORAGE_KEYS.SYNC_HISTORY] : [];
    return history.slice(0, limit);
  } catch (error) {
    throw new Error(`Failed to get sync history: ${error.message}`);
  }
}
