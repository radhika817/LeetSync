# LeetSync

Automatically Sync Your Accepted LeetCode Solutions to GitHub.

## Overview
LeetSync is a Chrome Extension (Manifest V3) that detects accepted submissions on LeetCode and automatically pushes them to your configured GitHub repository.

## Project Structure
- `manifest.json`: Manifest V3 configuration with minimal required permissions.
- `popup/`: Popup UI (`popup.html`, `popup.css`, `popup.js`) for configuring target GitHub repository and token.
- `scripts/`: Content and injection scripts (`content.js`, `inject.js`) to capture LeetCode submission events.
- `background/`: Background service worker (`service-worker.js`) to coordinate GitHub sync operations securely.
- `utils/`: ES modules for storage (`storage.js`), GitHub API (`github.js`), and LeetCode helpers (`leetcode.js`).
- `assets/icons/`: Extension icons (16px, 48px, 128px).

## Setup & Testing
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked** and select the `/home/radhika/Desktop/LeetSync` directory.
4. Pin LeetSync to your extension bar and open the popup to configure your repository and Personal Access Token.
