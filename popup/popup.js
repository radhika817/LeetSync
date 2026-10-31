// Popup script: handles saving and loading user configuration
document.addEventListener('DOMContentLoaded', async () => {
  const tokenInput = document.getElementById('ghToken');
  const repoInput = document.getElementById('ghRepo');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMessage');
  const badge = document.getElementById('connectionBadge');

  // Load existing repo config from chrome.storage.local
  // Note: we do not display token plaintext; we just check if it's set
  try {
    const data = await chrome.storage.local.get(['githubRepo', 'githubToken']);
    if (data.githubRepo) {
      repoInput.value = data.githubRepo;
    }
    if (data.githubToken && data.githubRepo) {
      badge.textContent = 'Connected';
      badge.classList.add('connected');
      tokenInput.placeholder = '•••••••••••••••• (Token configured)';
    }
  } catch (err) {
    showMessage('Failed to load settings', false);
  }

  saveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const repo = repoInput.value.trim();

    if (!repo) {
      showMessage('Please provide a repository name (e.g. username/repo)', false);
      return;
    }

    try {
      const updates = { githubRepo: repo };
      if (token) {
        updates.githubToken = token;
      }
      await chrome.storage.local.set(updates);
      badge.textContent = 'Connected';
      badge.classList.add('connected');
      showMessage('Settings saved successfully!', true);
      tokenInput.value = '';
      tokenInput.placeholder = '•••••••••••••••• (Token configured)';
    } catch (err) {
      showMessage('Error saving settings: ' + err.message, false);
    }
  });

  function showMessage(text, isSuccess) {
    statusMsg.textContent = text;
    statusMsg.className = `status-message ${isSuccess ? 'success' : 'error'}`;
    statusMsg.classList.remove('hidden');
    setTimeout(() => {
      statusMsg.classList.add('hidden');
    }, 3500);
  }
});
