/**
 * Storage utility functions for LeetSync
 */

export async function getStoredConfig() {
  try {
    return await chrome.storage.local.get(['githubRepo', 'githubToken']);
  } catch (error) {
    throw new Error(`Failed to read from storage: ${error.message}`);
  }
}

export async function saveStoredConfig(items) {
  try {
    await chrome.storage.local.set(items);
  } catch (error) {
    throw new Error(`Failed to write to storage: ${error.message}`);
  }
}
