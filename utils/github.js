/**
 * GitHub API helper utilities
 * Token is passed directly to functions and never logged or exposed.
 */

export async function checkRepository(token, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub error HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Repository check failed: ${error.message}`);
  }
}
