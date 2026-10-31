/**
 * Dev-only test helper for utils/github.js
 *
 * How to try this:
 * 1. Open the background service worker console (chrome://extensions -> Inspect views: service worker).
 * 2. In the console, you can run tests with:
 *
 *    import('./utils/github.js').then(async (gh) => {
 *      // 1. Test Unicode base64 round-trip
 *      const testStr = 'LeetSync \u2705 \u2014 \u03c0 \u2248 3.14159';
 *      const b64 = gh.utf8ToBase64(testStr);
 *      const decoded = gh.base64ToUtf8(b64);
 *      console.assert(testStr === decoded, 'Unicode base64 round-trip failed!');
 *      console.log('Unicode base64 test passed:', decoded);
 *
 *      // 2. Test verifyRepo
 *      // const repoInfo = await gh.verifyRepo('<YOUR_TOKEN>', '<OWNER>', '<REPO>');
 *      // console.log('verifyRepo result:', repoInfo);
 *
 *      // 3. Test getFile on non-existent file (should return null)
 *      // const missing = await gh.getFile('<YOUR_TOKEN>', '<OWNER>', '<REPO>', 'nonexistent.txt');
 *      // console.log('getFile missing:', missing); // null
 *
 *      // 4. Test putFile (create and update)
 *      // const res1 = await gh.putFile('<YOUR_TOKEN>', '<OWNER>', '<REPO>', {
 *      //   path: 'test/hello.txt',
 *      //   content: 'Hello from LeetSync! \u{1F680}',
 *      //   message: 'Test initial commit'
 *      // });
 *      // console.log('putFile created:', res1);
 *    });
 */

import { utf8ToBase64, base64ToUtf8, verifyRepo, getFile, putFile } from './utils/github.js';

export async function runSelfTest() {
  console.log('[LeetSync Test] Running Unicode base64 self-tests...');
  const samples = [
    'Simple ASCII',
    'Special characters: < > & " \'',
    'Unicode: \u4e2d\u6587 \u65e5\u672c\u8a9e \ud83d\ude80 \ud83d\udcbb',
    'C++ code snippet: #include <iostream>\nint main() { return 0; }'
  ];

  for (const sample of samples) {
    const encoded = utf8ToBase64(sample);
    const decoded = base64ToUtf8(encoded);
    if (sample !== decoded) {
      console.error('[LeetSync Test] Failed on sample:', sample);
      return false;
    }
  }

  console.log('[LeetSync Test] \u2705 All base64 encoding tests passed successfully!');
  return true;
}
