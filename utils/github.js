/**
 * GitHub REST API utility for LeetSync
 * Used exclusively by the background service worker.
 *
 * All functions accept the GitHub token explicitly, ensuring it is never stored
 * globally or logged in console messages.
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Encodes a UTF-8 string into standard base64 (handles multibyte Unicode safely).
 * @param {string} str
 * @returns {string}
 */
export function utf8ToBase64(str) {
  if (typeof str !== 'string') {
    throw new TypeError('utf8ToBase64 expected a string input');
  }
  // Convert UTF-8 string to percent-encoded bytes, then into binary string for btoa
  const bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  });
  return btoa(bytes);
}

/**
 * Decodes a base64 string back into a UTF-8 string safely.
 * @param {string} b64
 * @returns {string}
 */
export function base64ToUtf8(b64) {
  if (typeof b64 !== 'string') {
    throw new TypeError('base64ToUtf8 expected a string input');
  }
  // Remove newlines if any
  const cleaned = b64.replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = Array.from(binary)
    .map((char) => '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2))
    .join('');
  return decodeURIComponent(bytes);
}

/**
 * Parses response error codes into user-friendly messages.
 * @param {Response} response
 * @param {string} contextAction
 * @returns {Promise<Error>}
 */
async function parseGitHubError(response, contextAction) {
  let serverMessage = '';
  try {
    const errorJson = await response.json();
    serverMessage = errorJson.message || '';
  } catch (_) {
    // response might be non-JSON
  }

  const status = response.status;
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

  if (rateLimitRemaining === '0' || status === 403 && serverMessage.toLowerCase().includes('rate limit')) {
    const resetTime = response.headers.get('x-ratelimit-reset');
    const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toLocaleTimeString() : 'later';
    return new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}.`);
  }

  switch (status) {
    case 401:
      return new Error('Token expired or invalid: re-enter a valid GitHub PAT in the popup.');
    case 403:
      return new Error(`Access forbidden: Token lacks repository permissions for ${contextAction}. Ensure "repo" scope is selected on GitHub.`);
    case 404:
      return new Error(`Repository or resource not found (404) during ${contextAction}. Verify repo owner/name and PAT access in the popup.`);
    case 409:
      return new Error(`Concurrent modification conflict (409) on GitHub. Please retry submission.`);
    case 422:
      return new Error(`Validation failed (422) during ${contextAction}: check branch name in popup (${serverMessage || 'invalid payload'}).`);
    default:
      return new Error(`GitHub API error (${status}) during ${contextAction}: ${serverMessage || response.statusText}`);
  }
}

/**
 * Common headers for GitHub requests
 * @param {string} token
 * @returns {HeadersInit}
 */
function getHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeetSync-Chrome-Extension'
  };
}

/**
 * 1) Verify repository existence and access
 * GET /repos/{owner}/{repo}
 *
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<{ fullName: string, isPrivate: boolean, defaultBranch: string }>}
 */
export async function verifyRepo(token, owner, repo) {
  if (!token) throw new Error('GitHub token is required.');
  if (!owner || !repo) throw new Error('Repository owner and name are required.');

  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(token)
  });

  if (!response.ok) {
    throw await parseGitHubError(response, `verifying repository "${owner}/${repo}"`);
  }

  const data = await response.json();
  return {
    fullName: data.full_name,
    isPrivate: data.private,
    defaultBranch: data.default_branch
  };
}

/**
 * 2) Get file content and SHA from repository
 * GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
 *
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} path - path inside repository (e.g., "cpp/Two-Sum.cpp")
 * @param {string} [branch="main"]
 * @returns {Promise<{ sha: string, content: string } | null>} Returns null on 404
 */
export async function getFile(token, owner, repo, path, branch = 'main') {
  if (!token) throw new Error('GitHub token is required.');
  if (!owner || !repo || !path) throw new Error('Owner, repo, and path are required.');

  // Clean path: remove leading slashes and URL encode components
  const normalizedPath = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${normalizedPath}?ref=${encodeURIComponent(branch)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(token)
  });

  if (response.status === 404) {
    return null; // File does not exist yet
  }

  if (!response.ok) {
    throw await parseGitHubError(response, `fetching file "${path}"`);
  }

  const data = await response.json();
  if (data.type !== 'file') {
    throw new Error(`Path "${path}" is a ${data.type}, not a file.`);
  }

  const decodedContent = data.content ? base64ToUtf8(data.content) : '';

  return {
    sha: data.sha,
    content: decodedContent
  };
}

/**
 * 3) Create or update a file on GitHub
 * PUT /repos/{owner}/{repo}/contents/{path}
 * Includes automatic one-time retry on 409 Conflict.
 *
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {Object} options
 * @param {string} options.path - target file path
 * @param {string} options.content - UTF-8 file content
 * @param {string} options.message - commit message
 * @param {string} [options.sha] - existing file SHA if updating
 * @param {string} [options.branch="main"]
 * @param {boolean} [_isRetry=false] - internal flag for conflict retry
 * @returns {Promise<{ commitSha: string, contentSha: string, htmlUrl: string }>}
 */
export async function putFile(token, owner, repo, { path, content, message, sha, branch = 'main' }, _isRetry = false) {
  if (!token) throw new Error('GitHub token is required.');
  if (!owner || !repo || !path) throw new Error('Owner, repo, and path are required.');
  if (content === undefined || content === null) throw new Error('File content cannot be empty.');
  if (!message) throw new Error('Commit message is required.');

  const normalizedPath = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${normalizedPath}`;

  const payload = {
    message: message.trim(),
    content: utf8ToBase64(content),
    branch: branch.trim()
  };

  if (sha) {
    payload.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });

  // Handle 409 Conflict with one automatic retry
  if (response.status === 409 && !_isRetry) {
    const existingFile = await getFile(token, owner, repo, path, branch);
    if (existingFile && existingFile.sha) {
      return putFile(token, owner, repo, { path, content, message, sha: existingFile.sha, branch }, true);
    }
  }

  if (!response.ok) {
    throw await parseGitHubError(response, `saving file "${path}"`);
  }

  const result = await response.json();
  return {
    commitSha: result.commit?.sha,
    contentSha: result.content?.sha,
    htmlUrl: result.content?.html_url || result.commit?.html_url
  };
}
