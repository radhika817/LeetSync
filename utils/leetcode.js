/**
 * LeetCode problem & language helper functions
 */

export const LANGUAGE_EXTENSIONS = {
  cpp: '.cpp',
  'c++': '.cpp',
  java: '.java',
  python: '.py',
  python3: '.py',
  c: '.c',
  csharp: '.cs',
  'c#': '.cs',
  javascript: '.js',
  typescript: '.ts',
  ruby: '.rb',
  swift: '.swift',
  golang: '.go',
  go: '.go',
  scala: '.scala',
  kotlin: '.kt',
  rust: '.rs',
  php: '.php',
  bash: '.sh',
  sql: '.sql',
  mysql: '.sql',
  oracle: '.sql',
  dart: '.dart',
  r: '.r',
  elixir: '.ex',
  erlang: '.erl'
};

/**
 * Topic mapping for friendly folder names
 */
export const TOPIC_MAPPING = {
  array: 'Arrays',
  arrays: 'Arrays',
  string: 'Strings',
  strings: 'Strings',
  'hash table': 'Hash-Table',
  'hash-table': 'Hash-Table',
  hashtable: 'Hash-Table',
  'linked list': 'Linked-List',
  'linked-list': 'Linked-List',
  math: 'Math',
  'two pointers': 'Two-Pointers',
  'two-pointers': 'Two-Pointers',
  'dynamic programming': 'Dynamic-Programming',
  'dynamic-programming': 'Dynamic-Programming',
  dp: 'Dynamic-Programming',
  stack: 'Stack',
  queue: 'Queue',
  tree: 'Trees',
  trees: 'Trees',
  'binary tree': 'Trees',
  'binary search tree': 'Trees',
  graph: 'Graphs',
  graphs: 'Graphs',
  'depth-first search': 'DFS',
  'breadth-first search': 'BFS',
  'binary search': 'Binary-Search',
  heap: 'Heap',
  'priority queue': 'Heap',
  recursion: 'Recursion',
  backtracking: 'Backtracking',
  greedy: 'Greedy',
  trie: 'Trie',
  matrix: 'Matrix',
  'bit manipulation': 'Bit-Manipulation',
  sorting: 'Sorting',
  design: 'Design'
};

/**
 * Returns extension prefixed with dot (e.g. ".cpp") for given language name
 * @param {string} language
 * @returns {string}
 */
export function getFileExtension(language) {
  if (!language || typeof language !== 'string') return '.txt';
  const cleanLang = language.trim().toLowerCase();
  return LANGUAGE_EXTENSIONS[cleanLang] || '.txt';
}

/**
 * Format language for commit messages (e.g., cpp -> C++, python3 -> Python3)
 * @param {string} lang
 * @returns {string}
 */
export function formatLanguageDisplay(lang) {
  if (!lang) return 'Code';
  const lower = lang.toLowerCase();
  if (lower === 'cpp' || lower === 'c++') return 'C++';
  if (lower === 'csharp' || lower === 'c#') return 'C#';
  if (lower === 'javascript' || lower === 'js') return 'JavaScript';
  if (lower === 'typescript' || lower === 'ts') return 'TypeScript';
  if (lower === 'golang') return 'Go';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Finds the friendly topic folder name based on problem tags
 * @param {string[]} tags
 * @returns {string}
 */
export function getTopicFolder(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return 'Misc';
  }

  for (const tag of tags) {
    const normalized = String(tag).trim().toLowerCase();
    if (TOPIC_MAPPING[normalized]) {
      return TOPIC_MAPPING[normalized];
    }
  }

  // If first tag doesn't match predefined map, sanitize and use first tag title-cased
  const fallback = sanitizeFolderName(tags[0]);
  return fallback || 'Misc';
}

/**
 * Sanitizes problem title for file paths (e.g. "Two Sum" -> "Two-Sum")
 * @param {string} title
 * @returns {string}
 */
export function sanitizeTitle(title) {
  if (!title) return 'Solution';
  return title
    .replace(/[^\w\s-]/g, '') // remove special characters
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Sanitizes folder names
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFolderName(name) {
  if (!name) return 'Misc';
  return name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Builds the repo file path based on user settings and submission metadata
 * Path rule: [Topic]/[number]-[Title-Hyphenated].[ext]
 * @param {Object} submission
 * @param {Object} settings
 * @returns {string}
 */
export function buildSubmissionPath(submission, settings = {}) {
  const number = (submission.number || submission.id || '').toString().trim();
  const sanitizedTitle = sanitizeTitle(submission.title);
  const ext = submission.extension?.startsWith('.') ? submission.extension : `.${submission.extension || 'txt'}`;
  const fileName = `${number ? number + '-' : ''}${sanitizedTitle}${ext}`;

  const topicFolder = getTopicFolder(submission.tags);
  const langFolder = (submission.language || 'code').trim().toLowerCase();

  // If settings explicitly specify, we can also nest by language or topic
  // Default path rule: [Topic]/[number]-[Title-Hyphenated].[ext]
  let pathParts = [];

  if (settings.groupByTopic !== false) {
    // Topic enabled by default or per prompt rule
    pathParts.push(topicFolder);
  }

  if (settings.groupByLanguage) {
    pathParts.push(langFolder);
  }

  if (pathParts.length === 0) {
    pathParts.push(topicFolder);
  }

  pathParts.push(fileName);
  return pathParts.join('/');
}

/**
 * GraphQL Query to fetch full submission details including code, lang, question info, and topic tags.
 */
export const SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      runtime
      runtimeDisplay
      runtimePercentile
      memory
      memoryDisplay
      memoryPercentile
      code
      timestamp
      statusCode
      lang {
        name
        verboseName
      }
      question {
        questionId
        questionFrontendId
        title
        titleSlug
        translatedTitle
        difficulty
        topicTags {
          name
          slug
        }
      }
    }
  }
`;

/**
 * Fetches submission details from LeetCode's GraphQL API
 * Executes in content script so browser cookies/session are included automatically.
 *
 * @param {number|string} submissionId
 * @returns {Promise<{
 *   id: string,
 *   number: string,
 *   title: string,
 *   slug: string,
 *   language: string,
 *   extension: string,
 *   code: string,
 *   tags: string[],
 *   difficulty: string
 * }>}
 */
export async function fetchSubmissionDetails(submissionId) {
  const numericId = parseInt(submissionId, 10);
  if (isNaN(numericId)) {
    throw new Error(`Invalid submission ID: ${submissionId}`);
  }

  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      query: SUBMISSION_DETAILS_QUERY,
      variables: { submissionId: numericId },
      operationName: 'submissionDetails'
    })
  });

  if (!response.ok) {
    throw new Error(`LeetCode GraphQL error: HTTP ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    const errMsg = result.errors.map((e) => e.message).join(', ');
    throw new Error(`LeetCode GraphQL error: ${errMsg}`);
  }

  const details = result.data?.submissionDetails;
  if (!details) {
    throw new Error(`No submission details found for submission #${submissionId}`);
  }

  // Extract raw fields
  const code = details.code || '';
  const langName = details.lang?.name || details.lang?.verboseName || '';
  const question = details.question || {};
  const title = question.title || '';
  const slug = question.titleSlug || '';
  const number = question.questionFrontendId || question.questionId || '';
  const difficulty = question.difficulty || 'Unknown';
  const tags = Array.isArray(question.topicTags)
    ? question.topicTags.map((tag) => tag.name || tag.slug).filter(Boolean)
    : [];

  // Data Validation
  if (!code.trim()) {
    throw new Error(`Submission #${submissionId} returned empty code content.`);
  }

  if (!title.trim()) {
    throw new Error(`Submission #${submissionId} is missing problem title.`);
  }

  if (!langName.trim()) {
    throw new Error(`Submission #${submissionId} is missing programming language.`);
  }

  const extension = getFileExtension(langName);

  return {
    id: String(numericId),
    number: String(number),
    title: title.trim(),
    slug: slug.trim(),
    language: langName.trim().toLowerCase(),
    extension: extension,
    code: code,
    tags: tags,
    difficulty: difficulty
  };
}
