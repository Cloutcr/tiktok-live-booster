/**
 * Unit & Integration Test for GitHub Fleet Management
 */

const GitHubClient = require('../backend/github_client');

async function runTests() {
  console.log('--- Testing GitHubClient ---');
  
  // 1. Token Masking
  const masked1 = GitHubClient.maskToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
  console.log('Masked Token:', masked1);
  if (masked1 !== 'ghp_...wxyz') {
    throw new Error(`Token masking failed: expected ghp_...wxyz, got ${masked1}`);
  }

  // 2. Token Sanitization in Errors
  const client = new GitHubClient('ghp_secret_token_1234567890');
  const sanitized = client._sanitize('Error connecting with ghp_secret_token_1234567890 to GitHub API');
  console.log('Sanitized Error:', sanitized);
  if (sanitized.includes('ghp_secret_token_1234567890')) {
    throw new Error('Token sanitization failed to redact secret');
  }

  // 3. Template Files Retrieval
  const files = client.getProjectTemplateFiles();
  console.log(`Template files retrieved: ${files.length} files`);
  const paths = files.map(f => f.path);
  if (!paths.includes('.github/workflows/tiktok-app-booster.yml')) {
    throw new Error('Missing workflow template file');
  }
  if (!paths.includes('src/main.py')) {
    throw new Error('Missing src/main.py template file');
  }

  console.log('✓ All GitHubClient unit tests PASSED successfully!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
