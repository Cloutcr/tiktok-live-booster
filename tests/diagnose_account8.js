const { Pool } = require('pg');
const GitHubClient = require('../backend/github_client');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'fgos_admin',
  database: 'tiktok_live_booster',
  password: 'fgos_secure_2026',
  port: 5432
});

async function check() {
  const res = await pool.query('SELECT * FROM github_accounts WHERE id = 8');
  const acc = res.rows[0];
  if (!acc) {
    console.log('Account 8 not found in database');
    return;
  }
  console.log('Account in DB:', { id: acc.id, label: acc.label, owner: acc.owner, repo: acc.repo, is_active: acc.is_active });

  const client = new GitHubClient(acc.token);
  const val = await client.validateToken();
  console.log('Token Validation Result:');
  console.log('  Valid:', val.valid);
  if (val.valid) {
    console.log('  Actual GitHub Username (login):', val.user?.login);
    console.log('  Account Name:', val.user?.name);
    console.log('  Scopes:', val.scopes ? val.scopes.join(', ') : 'none');
    console.log('  Has repo scope:', val.hasRepoScope);
    console.log('  Has workflow scope:', val.hasWorkflowScope);

    // 1. Check if configured owner/repo exists
    const configuredRepoCheck = await client.checkRepoExists(acc.owner, acc.repo);
    console.log(`Repo Check [Configured: ${acc.owner}/${acc.repo}]:`, configuredRepoCheck);

    // 2. If configured owner != actual token login, check token login repo
    if (val.user?.login && val.user.login.toLowerCase() !== acc.owner.toLowerCase()) {
      const actualRepoCheck = await client.checkRepoExists(val.user.login, acc.repo);
      console.log(`Repo Check [Actual User: ${val.user.login}/${acc.repo}]:`, actualRepoCheck);
    }

    // 3. Check if workflow file exists in the repo
    const targetOwner = (val.user?.login && val.user.login.toLowerCase() !== acc.owner.toLowerCase()) ? val.user.login : acc.owner;
    try {
      const wfRes = await client._request(`/repos/${targetOwner}/${acc.repo}/actions/workflows/tiktok-app-booster.yml`);
      console.log(`Workflow File [${targetOwner}/${acc.repo}]: EXISTS, State: ${wfRes.data?.state}`);
    } catch (wfErr) {
      console.log(`Workflow File [${targetOwner}/${acc.repo}]: NOT FOUND / Error: ${wfErr.message}`);
    }
  } else {
    console.log('  Error:', val.error);
  }
}

check().catch(err => console.error('Diag Error:', err.message)).finally(() => pool.end());
