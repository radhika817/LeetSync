/**
 * LeetSync Popup Logic
 * Manages GitHub settings verification, user preferences, and sync history display.
 */

import {
  getStorage,
  setStorage,
  getSyncHistory,
  STORAGE_KEYS,
  DEFAULT_SETTINGS
} from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - GitHub Section
  const ghTokenInput = document.getElementById('ghToken');
  const repoOwnerInput = document.getElementById('repoOwner');
  const repoNameInput = document.getElementById('repoName');
  const branchInput = document.getElementById('branch');
  const verifyBtn = document.getElementById('verifyBtn');
  const verifyBtnText = document.getElementById('verifyBtnText');
  const verifyBtnSpinner = document.getElementById('verifyBtnSpinner');
  const tokenStatusText = document.getElementById('tokenStatusText');
  const connectionBadge = document.getElementById('connectionBadge');
  const statusAlert = document.getElementById('statusAlert');

  // DOM Elements - Settings Section
  const toggleLangFolder = document.getElementById('toggleLangFolder');
  const toggleTopicFolder = document.getElementById('toggleTopicFolder');
  const duplicateStrategySelect = document.getElementById('duplicateStrategy');
  const commitTemplate = document.getElementById('commitTemplate');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  // DOM Elements - History Section
  const historyList = document.getElementById('historyList');
  const historyCount = document.getElementById('historyCount');

  // DOM Elements - Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        if (targetId === 'tab-history') {
          renderSyncHistory();
        }
      }
    });
  });

  // Load existing state from storage
  await loadInitialState();

  // 1) Handle GitHub Verify & Save
  verifyBtn.addEventListener('click', async () => {
    const token = ghTokenInput.value.trim();
    const owner = repoOwnerInput.value.trim();
    const repo = repoNameInput.value.trim();
    const branch = branchInput.value.trim() || 'main';

    if (!owner || !repo) {
      showAlert('Please enter both repository owner and name.', 'error');
      return;
    }

    setLoading(true);
    showAlert('', ''); // Clear alert

    try {
      // Send message to background service worker to verify repository access
      const response = await chrome.runtime.sendMessage({
        action: 'VERIFY_GITHUB',
        payload: { token, owner, repo, branch }
      });

      if (response && response.ok) {
        setConnectedBadge(true);
        showAlert(`Connected to ${response.data.fullName} (${branch})!`, 'success');
        
        // Hide token input value and indicate it is securely stored
        ghTokenInput.value = '';
        ghTokenInput.placeholder = '••••••••••••••••••••';
        tokenStatusText.classList.remove('hidden');
      } else {
        setConnectedBadge(false);
        const errMessage = response?.error || 'Verification failed. Please check inputs.';
        showAlert(errMessage, 'error');
      }
    } catch (err) {
      setConnectedBadge(false);
      showAlert(`Extension communication error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  });

  // 2) Handle Settings Save
  saveSettingsBtn.addEventListener('click', async () => {
    try {
      const settings = {
        groupByLanguage: toggleLangFolder.checked,
        groupByTopic: toggleTopicFolder.checked,
        duplicateStrategy: duplicateStrategySelect.value || 'update',
        commitMessageTemplate: commitTemplate.value.trim() || DEFAULT_SETTINGS.commitMessageTemplate
      };

      await setStorage({ [STORAGE_KEYS.SETTINGS]: settings });
      showAlert('Settings updated successfully!', 'success');
    } catch (err) {
      showAlert(`Failed to save settings: ${err.message}`, 'error');
    }
  });

  // Helper: Initial Load
  async function loadInitialState() {
    try {
      const data = await getStorage([
        STORAGE_KEYS.GITHUB_TOKEN,
        STORAGE_KEYS.REPO_OWNER,
        STORAGE_KEYS.REPO_NAME,
        STORAGE_KEYS.BRANCH,
        STORAGE_KEYS.SETTINGS
      ]);

      // Populate GitHub fields
      if (data[STORAGE_KEYS.REPO_OWNER]) repoOwnerInput.value = data[STORAGE_KEYS.REPO_OWNER];
      if (data[STORAGE_KEYS.REPO_NAME]) repoNameInput.value = data[STORAGE_KEYS.REPO_NAME];
      if (data[STORAGE_KEYS.BRANCH]) branchInput.value = data[STORAGE_KEYS.BRANCH];

      // Never show the plaintext token, only badge that it's saved
      if (data[STORAGE_KEYS.GITHUB_TOKEN]) {
        tokenStatusText.classList.remove('hidden');
        ghTokenInput.placeholder = '••••••••••••••••••••';
        if (data[STORAGE_KEYS.REPO_OWNER] && data[STORAGE_KEYS.REPO_NAME]) {
          setConnectedBadge(true);
        }
      }

      // Populate Settings
      const settings = data[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
      toggleLangFolder.checked = settings.groupByLanguage !== false;
      toggleTopicFolder.checked = Boolean(settings.groupByTopic);
      duplicateStrategySelect.value = settings.duplicateStrategy || 'update';
      commitTemplate.value = settings.commitMessageTemplate || DEFAULT_SETTINGS.commitMessageTemplate;

      // Populate History
      await renderSyncHistory();
    } catch (err) {
      showAlert(`Error loading configuration: ${err.message}`, 'error');
    }
  }

  // Helper: Render last 5 syncs
  async function renderSyncHistory() {
    try {
      const history = await getSyncHistory(5);
      historyCount.textContent = `${history.length} recent`;

      if (!history || history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No solutions synced yet.</div>';
        return;
      }

      historyList.innerHTML = history
        .map((item) => {
          const time = formatRelativeTime(item.timestamp);
          const lang = escapeHtml(item.language || 'code');
          const title = escapeHtml(item.problemTitle || 'Unknown Problem');
          const status = item.status || 'SUCCESS';
          const statusLabel = formatStatusLabel(status);

          let linkHtml = '';
          if (item.commitUrl) {
            linkHtml = `
              <a href="${item.commitUrl}" target="_blank" rel="noopener noreferrer" class="history-link" title="Open file on GitHub">
                View &rarr;
              </a>
            `;
          }

          return `
            <div class="history-item status-${escapeHtml(status)}">
              <div class="history-header">
                <span class="history-title" title="${title}">${title}</span>
                ${linkHtml}
              </div>
              <div class="history-footer">
                <div class="history-badges">
                  <span class="history-lang">${lang}</span>
                  <span class="history-status-badge ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                </div>
                <span class="history-time">${time}</span>
              </div>
            </div>
          `;
        })
        .join('');
    } catch (err) {
      historyList.innerHTML = '<div class="empty-history">Failed to load history</div>';
    }
  }

  function formatStatusLabel(status) {
    switch (status) {
      case 'SUCCESS':
        return 'Synced';
      case 'ALREADY_SYNCED':
        return 'Up to date';
      case 'SKIPPED':
        return 'Skipped';
      case 'FAILED':
        return 'Failed';
      default:
        return status;
    }
  }

  function setLoading(isLoading) {
    verifyBtn.disabled = isLoading;
    if (isLoading) {
      verifyBtnSpinner.classList.remove('hidden');
      verifyBtnText.textContent = 'Verifying...';
    } else {
      verifyBtnSpinner.classList.add('hidden');
      verifyBtnText.textContent = 'Save & Verify';
    }
  }

  function setConnectedBadge(isConnected) {
    if (isConnected) {
      connectionBadge.textContent = 'Connected';
      connectionBadge.className = 'status-indicator connected';
    } else {
      connectionBadge.textContent = 'Disconnected';
      connectionBadge.className = 'status-indicator error';
    }
  }

  function showAlert(msg, type) {
    if (!msg) {
      statusAlert.classList.add('hidden');
      return;
    }
    statusAlert.textContent = msg;
    statusAlert.className = `status-alert ${type}`;
    statusAlert.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => {
        statusAlert.classList.add('hidden');
      }, 4000);
    }
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'recently';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${Math.floor(diffHour / 24)}d ago`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
