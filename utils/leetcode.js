/**
 * LeetCode problem & language helper functions
 */

export const LANGUAGE_EXTENSIONS = {
  cpp: 'cpp',
  'c++': 'cpp',
  java: 'java',
  python: 'py',
  python3: 'py',
  c: 'c',
  csharp: 'cs',
  javascript: 'js',
  typescript: 'ts',
  ruby: 'rb',
  swift: 'swift',
  golang: 'go',
  go: 'go',
  scala: 'scala',
  kotlin: 'kt',
  rust: 'rs',
  php: 'php'
};

export function getFileExtension(language) {
  if (!language) return 'txt';
  const cleanLang = language.trim().toLowerCase();
  return LANGUAGE_EXTENSIONS[cleanLang] || 'txt';
}
