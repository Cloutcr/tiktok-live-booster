/**
 * TikTok Live Booster - Production GitHub API Client
 * Secure, rate-limit aware client for managing 100-500 runner repositories.
 */

const fs = require('fs');
const path = require('path');

class GitHubClient {
  constructor(token) {
    this.token = token ? token.trim() : '';
    this.rateLimit = {
      remaining: 5000,
      resetTime: 0,
      limit: 5000
    };
  }

  static maskToken(token) {
    if (!token || typeof token !== 'string') return 'N/A';
    const trimmed = token.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  _sanitize(errMessage) {
    if (!errMessage || typeof errMessage !== 'string') return 'Unknown GitHub API error';
    let clean = errMessage;
    if (this.token && this.token.length > 5) {
      clean = clean.split(this.token).join('[REDACTED_TOKEN]');
    }
    return clean
      .replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_[REDACTED]')
      .replace(/github_pat_[a-zA-Z0-9_]{30,}/g, 'github_pat_[REDACTED]')
      .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
  }

  async _request(endpoint, options = {}, retries = 2) {
    const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'TikTok-Live-Booster-Fleet-Manager',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    // Rate-limit throttle check
    if (this.rateLimit.remaining < 10 && this.rateLimit.resetTime > Date.now()) {
      const waitMs = Math.min(this.rateLimit.resetTime - Date.now() + 1000, 60000);
      console.warn(`[GitHub RateLimit] Low quota (${this.rateLimit.remaining} remaining). Throttling for ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Update rate-limit metrics from response headers
      const remainingHeader = response.headers.get('x-ratelimit-remaining');
      const resetHeader = response.headers.get('x-ratelimit-reset');
      const limitHeader = response.headers.get('x-ratelimit-limit');
      const retryAfterHeader = response.headers.get('retry-after');

      if (remainingHeader !== null) this.rateLimit.remaining = parseInt(remainingHeader, 10);
      if (resetHeader !== null) this.rateLimit.resetTime = parseInt(resetHeader, 10) * 1000;
      if (limitHeader !== null) this.rateLimit.limit = parseInt(limitHeader, 10);

      // Handle secondary rate limits or 429 Too Many Requests
      if ((response.status === 403 || response.status === 429 || response.status === 503) && retries > 0) {
        let backoff = (3 - retries) * 2500 + 1000;
        if (retryAfterHeader) {
          const parsedSecs = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSecs)) {
            backoff = (parsedSecs * 1000) + 500;
          }
        }
        console.warn(`[GitHub API] HTTP ${response.status} (Rate limit / Throttle). Backing off for ${backoff}ms (Retries left: ${retries})...`);
        await new Promise(r => setTimeout(r, backoff));
        return this._request(endpoint, options, retries - 1);
      }

      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await response.json().catch(() => ({})) : null;

      if (!response.ok && response.status !== 204 && response.status !== 201) {
        const errorMsg = data?.message || `GitHub HTTP ${response.status}: ${response.statusText}`;
        const error = new Error(this._sanitize(errorMsg));
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return {
        status: response.status,
        headers: response.headers,
        data
      };
    } catch (err) {
      if (retries > 0 && (err.message.includes('fetch') || err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT'))) {
        await new Promise(r => setTimeout(r, 1500));
        return this._request(endpoint, options, retries - 1);
      }
      throw new Error(this._sanitize(err.message));
    }
  }

  /**
   * Validates token authentication and verifies necessary OAuth scopes.
   */
  async validateToken() {
    if (!this.token || this.token.length < 10) {
      return { valid: false, error: 'GitHub Personal Access Token is required' };
    }

    try {
      const res = await this._request('/user');
      const user = res.data;
      const scopes = res.headers.get('x-oauth-scopes') || '';
      const scopeList = scopes.split(',').map(s => s.trim()).filter(Boolean);

      // Check essential workflow & repo permissions for classic PATs
      const hasRepoScope = scopeList.includes('repo') || scopeList.includes('public_repo');
      const hasWorkflowScope = scopeList.includes('workflow');

      return {
        valid: true,
        user: {
          id: user.id,
          login: user.login,
          name: user.name || user.login,
          type: user.type,
          avatar_url: user.avatar_url,
          public_repos: user.public_repos,
          total_private_repos: user.total_private_repos
        },
        scopes: scopeList,
        hasRepoScope,
        hasWorkflowScope,
        rateLimit: this.rateLimit
      };
    } catch (err) {
      return { valid: false, error: this._sanitize(err.message) };
    }
  }

  /**
   * Checks if a repository already exists.
   */
  async checkRepoExists(owner, repo) {
    try {
      const res = await this._request(`/repos/${owner}/${repo}`);
      return { exists: true, data: res.data };
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('Not Found') || err.status === 404) {
        return { exists: false };
      }
      throw err;
    }
  }

  /**
   * Creates a repository on GitHub under the authenticated user or organization.
   * Handles idempotency if the repo already exists.
   */
  async createRepository(repoName, isPrivate = false, description = 'TikTok Live Booster Cloud Runner Fleet') {
    const payload = {
      name: repoName,
      private: isPrivate,
      description,
      auto_init: true // Creates default branch with README for instant commits
    };

    try {
      const res = await this._request('/user/repos', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return res.data;
    } catch (err) {
      if (err.message.includes('name already exists') || err.status === 422) {
        return { name: repoName, already_existed: true };
      }
      throw err;
    }
  }

  /**
   * Collects local runner project files to be committed into newly created fleet repositories.
   */
  getProjectTemplateFiles() {
    const rootDir = path.resolve(__dirname, '..');
    const filesToUpload = [
      '.github/workflows/tiktok-app-booster.yml',
      'requirements.txt',
      'accounts.json',
      'accounts_template.json',
      'scripts/run_emulator_session.sh',
      'scripts/setup_scrcpy.sh',
      'scripts/fast_tap.sh',
      'src/main.py',
      'src/models.py',
      'src/config.py',
      'src/adb_controller.py',
      'src/stream_forwarder.py',
      'src/auto_login.py',
      'src/drive_service.py',
      'src/sheet_service.py',
      'src/vpn_service.py'
    ];

    const fileMap = [];
    for (const relPath of filesToUpload) {
      const absPath = path.join(rootDir, relPath);
      if (fs.existsSync(absPath)) {
        const content = fs.readFileSync(absPath);
        fileMap.push({
          path: relPath.replace(/\\/g, '/'),
          content: content.toString('base64'),
          encoding: 'base64'
        });
      }
    }
    return fileMap;
  }

  /**
   * Commits all runner files atomically into the repository using the Git Data API.
   */
  async pushRunnerFiles(owner, repo, branch = 'main') {
    const files = this.getProjectTemplateFiles();
    if (files.length === 0) {
      throw new Error('No template files found to push to fleet repository');
    }

    // 1. Get reference to HEAD commit on target branch
    let headCommitSha = null;
    let baseTreeSha = null;

    try {
      const refRes = await this._request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
      headCommitSha = refRes.data.object.sha;
      const commitRes = await this._request(`/repos/${owner}/${repo}/git/commits/${headCommitSha}`);
      baseTreeSha = commitRes.data.tree.sha;
    } catch (refErr) {
      // If branch doesn't exist yet, wait 1s for GitHub auto_init
      await new Promise(r => setTimeout(r, 1200));
      try {
        const refRes = await this._request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
        headCommitSha = refRes.data.object.sha;
        const commitRes = await this._request(`/repos/${owner}/${repo}/git/commits/${headCommitSha}`);
        baseTreeSha = commitRes.data.tree.sha;
      } catch (e2) {
        // Fallback to Contents API for root file if repo empty
        for (const file of files) {
          await this.putContentFile(owner, repo, file.path, file.content, 'Initialize TikTok Booster runner file');
        }
        return true;
      }
    }

    // 2. Create Tree with all files
    const treeItems = files.map(file => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: Buffer.from(file.content, 'base64').toString('utf8')
    }));

    const treeRes = await this._request(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });

    const newTreeSha = treeRes.data.sha;

    // 3. Create Commit
    const commitPayload = {
      message: 'feat(fleet): configure TikTok Live Booster runner and workflow',
      tree: newTreeSha,
      parents: headCommitSha ? [headCommitSha] : []
    };

    const newCommitRes = await this._request(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify(commitPayload)
    });

    const newCommitSha = newCommitRes.data.sha;

    // 4. Update Branch Reference
    await this._request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: newCommitSha,
        force: true
      })
    });

    return true;
  }

  /**
   * Helper to write a single file via Contents API (fallback)
   */
  async putContentFile(owner, repo, filePath, base64Content, message) {
    let sha = undefined;
    try {
      const getRes = await this._request(`/repos/${owner}/${repo}/contents/${filePath}`);
      sha = getRes.data.sha;
    } catch (_) {}

    return this._request(`/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: message || `Update ${filePath}`,
        content: base64Content,
        sha
      })
    });
  }

  /**
   * Verifies that the workflow is recognized by GitHub Actions.
   */
  async verifyWorkflow(owner, repo, workflowFile = 'tiktok-app-booster.yml') {
    try {
      const res = await this._request(`/repos/${owner}/${repo}/actions/workflows/${workflowFile}`);
      return {
        verified: true,
        workflow: res.data
      };
    } catch (err) {
      return {
        verified: false,
        error: this._sanitize(err.message)
      };
    }
  }

  /**
   * Dispatches the GitHub Actions workflow with runtime parameters.
   */
  async dispatchWorkflow(owner, repo, workflowFile = 'tiktok-app-booster.yml', inputs = {}) {
    const payload = {
      ref: 'main',
      inputs: {
        stream_url: String(inputs.stream_url || 'https://www.tiktok.com/@tiktok/live').trim(),
        duration_minutes: String(inputs.duration_minutes || 60),
        likes_per_minute: String(inputs.likes_per_minute || 180),
        runner_count: String(inputs.runner_count || 1),
        vpn_provider: String(inputs.vpn_provider || 'none')
      }
    };

    const res = await this._request(`/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      success: res.status === 204 || res.status === 200 || res.status === 201,
      statusCode: res.status
    };
  }

  /**
   * Lists active (in_progress, queued) workflow runs for a repository.
   */
  async listActiveRuns(owner, repo) {
    const runs = [];
    for (const status of ['in_progress', 'queued']) {
      try {
        const res = await this._request(`/repos/${owner}/${repo}/actions/runs?status=${status}&per_page=10`);
        if (res.data?.workflow_runs) {
          runs.push(...res.data.workflow_runs);
        }
      } catch (_) {}
    }
    return runs;
  }

  /**
   * Cancels a workflow run by ID.
   */
  async cancelRun(owner, repo, runId) {
    try {
      const res = await this._request(`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`, {
        method: 'POST'
      });
      return { success: res.status === 202 || res.status === 200 };
    } catch (err) {
      return { success: false, error: this._sanitize(err.message) };
    }
  }
}

module.exports = GitHubClient;
