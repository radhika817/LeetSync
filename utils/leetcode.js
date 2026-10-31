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
