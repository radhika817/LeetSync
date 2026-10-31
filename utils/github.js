/**
 * GitHub API helper utilities
 * Token is passed into functions and never logged or exposed.
 */

/**
 * Validates repository accessibility and token permissions
 * @param {string} token - GitHub Personal Access Token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{ ok: boolean, data?: Object, error?: string }>}
 */
export async function verifyRepository(token, owner, repo) {
  try {
    if (!token) {
      return { ok: false, error: 'Personal Access Token is missing.' };
    }
    if (!owner || !repo) {
      return { ok: false, error: 'Repository owner and name are required.' };
    }

    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'LeetSync-Chrome-Extension'
      }
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      let msg = errorJson.message || `HTTP ${response.status}`;
      if (response.status === 401) {
        msg = 'Invalid GitHub Token or token expired.';
      } else if (response.status === 404) {
        msg = `Repository "${owner}/${repo}" not found or token lacks 'repo' permission.`;
      }
      return { ok: false, error: msg };
    }

    const data = await response.json();
    return {
      ok: true,
      data: {
        fullName: data.full_name,
        isPrivate: data.private,
        defaultBranch: data.default_branch
      }
    };
  } catch (error) {
    return { ok: false, error: `Network error verifying repo: ${error.message}` };
  }
}
