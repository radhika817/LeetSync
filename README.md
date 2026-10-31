# LeetSync

> Automatically sync your accepted LeetCode solutions to GitHub with zero friction.

LeetSync is a lightweight, privacy-focused Chrome Extension (Manifest V3, vanilla ES modules, no build steps required) that detects when you achieve an **Accepted** verdict on LeetCode and automatically commits your solution code to your designated GitHub repository.

---

## Features

- **Automated Detection**: Hooks into LeetCode's submission flow in the browser without DOM scraping.
- **Smart Organization**: Automatically categorizes files by problem topic (e.g. `Arrays/`, `Linked-List/`, `Trees/`, `Dynamic-Programming/`) and includes problem numbers and titles.
- **Multi-Language Support**: Supports C++, Python, Java, JavaScript, TypeScript, Go, Rust, and more.
- **Duplicate & Revision Handling**: Skips identical submissions to avoid redundant commits. Configurable strategy when code changes (Update existing, Skip, or Save as new version `_v2.ext`).
- **Visual Feedback**: Real-time desktop notifications and icon badges (`✓` for success, `!` for errors).
- **Privacy-First**: Zero external servers or tracking. Credentials remain solely within your local browser.

---

## Installation (Load Unpacked)

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle in the upper-right corner.
4. Click the **Load unpacked** button in the upper-left corner.
5. Select the `LeetSync` folder.
6. Pin **LeetSync** to your Chrome toolbar for easy access.

---

## Creating a GitHub Personal Access Token

LeetSync requires a GitHub Personal Access Token (PAT) to commit solutions directly to your repository via GitHub's REST API.

### Option A: Fine-Grained Token (Recommended)
1. Go to [GitHub Settings > Personal Access Tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta).
2. Click **Generate new token**.
3. Fill in:
   - **Token name**: e.g., `LeetSync Extension`.
   - **Expiration**: Select your preferred duration (e.g., 90 days).
   - **Resource owner**: Your GitHub account.
   - **Repository access**: Select **Only select repositories** and pick your target repository (e.g., `leetcode-solutions`).
4. Under **Repository permissions**:
   - Locate **Contents**: select **Access: Read and write**.
   *(Metadata read access is automatically included).*
5. Click **Generate token** and copy the generated token (`github_pat_...`).

### Option B: Classic Token
1. Go to [GitHub Settings > Developer Settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Name the token and check the **`repo`** scope.
4. Click **Generate token** and copy the value (`ghp_...`).

---

## Usage

1. Click the **LeetSync** extension icon in your browser toolbar.
2. Enter:
   - **Personal Access Token**: Paste your generated PAT.
   - **Owner / User**: Your GitHub username (e.g. `your-username`).
   - **Repository**: Your target repository name (e.g. `leetcode-solutions`).
   - **Branch**: Target branch (default is `main`).
3. Click **Save & Verify**. The extension verifies repository access and switches to a green **Connected** badge.
4. Navigate to any [LeetCode](https://leetcode.com/problems/) problem and submit your solution.
5. Once your solution gets **Accepted**, LeetSync commits it to GitHub and sends a desktop notification with a link to view your file!

---

## Repository Folder Structure

Solutions are organized into structured directories according to your settings:

```text
your-repo/
├── Arrays/
│   ├── 1-Two-Sum.cpp
│   └── 121-Best-Time-to-Buy-and-Sell-Stock.py
├── Linked-List/
│   ├── 206-Reverse-Linked-List.py
│   └── 206-Reverse-Linked-List_v2.py
├── Stack/
│   └── 20-Valid-Parentheses.java
├── Dynamic-Programming/
│   └── 70-Climbing-Stairs.cpp
└── Misc/
    └── 999-Custom-Problem.py
```

---

## Project Structure

```text
LeetSync/
├── manifest.json              # Chrome Manifest V3 configuration
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Dark-mode styling
│   └── popup.js               # Popup configuration & history controller
├── scripts/
│   ├── content.js             # Content script (fetches GraphQL & coordinates sync)
│   └── inject.js              # Injected network hook detecting submissions
├── background/
│   └── service-worker.js      # Background service worker coordinating GitHub commits
├── utils/
│   ├── github.js              # GitHub REST API client & Unicode base64 helpers
│   ├── leetcode.js            # GraphQL query, language mapping & path generator
│   └── storage.js             # Promise-wrapped chrome.storage.local helper
└── assets/
    └── icons/                 # Extension icons (16, 48, 128px)
```

---

## Troubleshooting

- **Extension shows "Token expired or invalid"**:
  - Your PAT may have expired or was revoked. Generate a new token and update it via the popup.
- **"Repository not found (404)"**:
  - Confirm the repository exists and that your GitHub username and repository name are spelled correctly.
  - If using a fine-grained token, verify that the token has been granted access to that specific repository.
- **Submissions are not syncing**:
  - Ensure the submission verdict is **Accepted**. Wrong answers, compilation errors, and runtime errors will not sync.
  - Refresh the LeetCode tab if it was opened before the extension was installed or reloaded.
- **"Access forbidden: Token lacks permissions"**:
  - Ensure your token has **Read and write** permissions for repository **Contents** (or the full `repo` scope for classic tokens).
- **Submissions skipped**:
  - If you re-submit identical code, LeetSync automatically skips creating duplicate commits. Check your popup settings under **On Different Code** to adjust revision behavior.

---

## Privacy Policy & Security Note

- **Direct Communication**: LeetSync only communicates directly with `https://leetcode.com` and `https://api.github.com`.
- **Zero Third-Party Tracking**: No telemetry, analytics, cookies, or user data are ever collected, transmitted, or stored on external servers.
- **Secure Token Storage**: Your GitHub Personal Access Token is stored strictly inside Chrome's local storage (`chrome.storage.local`) and is read exclusively inside the extension's isolated background service worker. It is never logged in console outputs or exposed to page scripts.
