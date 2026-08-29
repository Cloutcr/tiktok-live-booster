/**
 * TikTok Live Booster - Production Fleet Background Worker
 * Manages controlled-concurrency repository creation, workflow setup, and dispatch for 100-500 repos.
 */

const GitHubClient = require('./github_client');

class FleetWorker {
  constructor(pool, broadcastCallback, concurrency = 3) {
    this.pool = pool;
    this.broadcastWs = broadcastCallback || (() => {});
    this.concurrency = concurrency;
    this.activeJobs = new Map(); // jobId -> abortController
    this.isProcessing = false;
  }

  /**
   * Spawns a background worker task to process a fleet creation/dispatch job.
   */
  startJob(jobId, fleetId, account, repoConfigs, dispatchParams) {
    const abortController = new AbortController();
    this.activeJobs.set(jobId, abortController);

    // Run asynchronously without blocking HTTP response
    setImmediate(() => {
      this._processJob(jobId, fleetId, account, repoConfigs, dispatchParams, abortController.signal)
        .catch(err => {
          console.error(`[FleetWorker] Job #${jobId} error:`, err);
        })
        .finally(() => {
          this.activeJobs.delete(jobId);
        });
    });
  }

  /**
   * Core concurrency processor for fleet items
   */
  async _processJob(jobId, fleetId, account, repoConfigs, dispatchParams, signal) {
    const ghClient = this._createClient ? this._createClient(account.token) : new GitHubClient(account.token);
    console.log(`[FleetWorker] Starting Fleet Job #${jobId} (Items: ${repoConfigs.length}, Concurrency: ${this.concurrency})`);

    // 1. Mark Job as IN_PROGRESS
    await this.pool.query(
      "UPDATE fleet_jobs SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [jobId]
    );

    this.broadcastWs('FLEET_JOB_UPDATE', {
      job_id: jobId,
      fleet_id: fleetId,
      status: 'IN_PROGRESS',
      total_items: repoConfigs.length,
      completed_items: 0,
      failed_items: 0
    });

    let completedCount = 0;
    let failedCount = 0;

    // 2. Queue with concurrency limiter
    const queue = [...repoConfigs];
    let queueIndex = 0;

    const worker = async (workerId) => {
      while (queueIndex < queue.length) {
        if (signal.aborted) break;

        const currentIndex = queueIndex++;
        const item = queue[currentIndex];
        if (!item) break;

        try {
          await this._processSingleItem(jobId, fleetId, account, ghClient, item, dispatchParams, signal);
          completedCount++;
        } catch (itemErr) {
          failedCount++;
          console.error(`[FleetWorker] Item failed (${item.repo}):`, itemErr.message);
          await this._markItemFailed(jobId, item.repo, itemErr.message);
        }

        // Update Job counters in PostgreSQL and broadcast progress
        await this.pool.query(
          "UPDATE fleet_jobs SET completed_items = $1, failed_items = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
          [completedCount, failedCount, jobId]
        );

        this.broadcastWs('FLEET_JOB_UPDATE', {
          job_id: jobId,
          fleet_id: fleetId,
          status: 'IN_PROGRESS',
          total_items: repoConfigs.length,
          completed_items: completedCount,
          failed_items: failedCount,
          latest_repo: item.repo
        });
      }
    };

    // Run parallel workers up to concurrency limit
    const workers = [];
    for (let w = 0; w < Math.min(this.concurrency, repoConfigs.length); w++) {
      workers.push(worker(w + 1));
    }

    await Promise.all(workers);

    // 3. Finalize Job Status
    const finalStatus = failedCount === 0 ? 'COMPLETED' : (completedCount > 0 ? 'PARTIALLY_FAILED' : 'FAILED');
    const errorSummary = failedCount > 0 ? `${failedCount} of ${repoConfigs.length} repositories failed to configure.` : null;

    await this.pool.query(
      "UPDATE fleet_jobs SET status = $1, completed_items = $2, failed_items = $3, error_message = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
      [finalStatus, completedCount, failedCount, errorSummary, jobId]
    );

    // Also update Fleet status
    await this.pool.query(
      "UPDATE fleets SET status = $1, total_repos = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [finalStatus === 'FAILED' ? 'ERROR' : 'ACTIVE', completedCount, fleetId]
    );

    this.broadcastWs('FLEET_JOB_UPDATE', {
      job_id: jobId,
      fleet_id: fleetId,
      status: finalStatus,
      total_items: repoConfigs.length,
      completed_items: completedCount,
      failed_items: failedCount,
      error_message: errorSummary
    });

    console.log(`[FleetWorker] Finished Fleet Job #${jobId} -> Status: ${finalStatus} (Completed: ${completedCount}, Failed: ${failedCount})`);
  }

  /**
   * Processes a single repository: Create -> Push Workflow -> Verify -> Dispatch
   */
  async _processSingleItem(jobId, fleetId, account, ghClient, item, dispatchParams, signal) {
    const owner = item.owner || account.owner;
    const repo = item.repo;
    const runnerCount = item.runner_count || dispatchParams.runner_count || 1;

    console.log(`[FleetWorker] Processing repo: ${owner}/${repo}...`);

    // Step 1: Ensure repository exists or create it
    await this._updateItemStep(jobId, repo, 'CREATING_REPO');
    const check = await ghClient.checkRepoExists(owner, repo);

    if (!check.exists) {
      console.log(`[FleetWorker] Creating repository ${owner}/${repo} on GitHub...`);
      await ghClient.createRepository(repo, false, 'TikTok Live Booster Cloud Runner Fleet');
      // Wait for GitHub repository provisioning
      await new Promise(r => setTimeout(r, 1500));
    }

    if (signal.aborted) return;

    // Step 2: Push template workflow and runner files if needed
    await this._updateItemStep(jobId, repo, 'PUSHING_WORKFLOW');
    const wfCheck = await ghClient.verifyWorkflow(owner, repo, 'tiktok-app-booster.yml');

    if (!wfCheck.verified) {
      console.log(`[FleetWorker] Pushing runner files & workflow to ${owner}/${repo}...`);
      await ghClient.pushRunnerFiles(owner, repo, 'main');
      // Wait for GitHub Actions parser to detect the workflow
      await new Promise(r => setTimeout(r, 2000));
    }

    if (signal.aborted) return;

    // Step 3: Verify workflow existence
    await this._updateItemStep(jobId, repo, 'VERIFYING');
    let isWfReady = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const checkWf = await ghClient.verifyWorkflow(owner, repo, 'tiktok-app-booster.yml');
      if (checkWf.verified) {
        isWfReady = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!isWfReady) {
      throw new Error(`Workflow tiktok-app-booster.yml not yet recognized by GitHub Actions on ${owner}/${repo}`);
    }

    if (signal.aborted) return;

    // Step 4: Dispatch workflow
    await this._updateItemStep(jobId, repo, 'DISPATCHING');
    const dispatchRes = await ghClient.dispatchWorkflow(owner, repo, 'tiktok-app-booster.yml', {
      stream_url: dispatchParams.stream_url,
      duration_minutes: dispatchParams.duration_minutes,
      likes_per_minute: dispatchParams.likes_per_minute,
      runner_count: runnerCount,
      vpn_provider: dispatchParams.vpn_provider || 'none'
    });

    if (!dispatchRes.success) {
      throw new Error(`Workflow dispatch failed (HTTP ${dispatchRes.statusCode})`);
    }

    // Step 5: Save/Update in PostgreSQL repositories table
    await this.pool.query(`
      INSERT INTO repositories (fleet_id, account_id, owner, repo, status, workflow_status, dispatch_status, runner_count, error_message, last_checked, updated_at)
      VALUES ($1, $2, $3, $4, 'RUNNING', 'ACTIVE', 'DISPATCHED', $5, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (owner, repo) DO UPDATE SET
        fleet_id = EXCLUDED.fleet_id,
        account_id = EXCLUDED.account_id,
        status = 'RUNNING',
        workflow_status = 'ACTIVE',
        dispatch_status = 'DISPATCHED',
        runner_count = EXCLUDED.runner_count,
        error_message = NULL,
        last_checked = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [fleetId, account.id, owner, repo, runnerCount]);

    // Also register in github_accounts if not present so legacy runner lookups match
    await this.pool.query(`
      INSERT INTO github_accounts (label, owner, repo, token, max_runners, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT DO NOTHING
    `, [`Fleet [${repo}]`, owner, repo, account.token, runnerCount]).catch(() => {});

    // Mark item as DONE
    await this.pool.query(
      "UPDATE fleet_job_items SET step = 'DONE', status = 'COMPLETED', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE job_id = $1 AND repo_name = $2",
      [jobId, repo]
    );

    this.broadcastWs('REPO_UPDATE', {
      fleet_id: fleetId,
      owner,
      repo,
      status: 'RUNNING',
      dispatch_status: 'DISPATCHED',
      runner_count: runnerCount
    });
  }

  async _updateItemStep(jobId, repoName, step) {
    await this.pool.query(
      "UPDATE fleet_job_items SET step = $1, status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE job_id = $2 AND repo_name = $3",
      [step, jobId, repoName]
    );
  }

  async _markItemFailed(jobId, repoName, errorMessage) {
    await this.pool.query(
      "UPDATE fleet_job_items SET step = 'FAILED', status = 'FAILED', error_message = $1, updated_at = CURRENT_TIMESTAMP WHERE job_id = $2 AND repo_name = $3",
      [errorMessage, jobId, repoName]
    );
  }

  /**
   * Retries all failed items in a job.
   */
  async retryJob(jobId, dispatchParams) {
    const jobRes = await this.pool.query("SELECT * FROM fleet_jobs WHERE id = $1", [jobId]);
    const job = jobRes.rows[0];
    if (!job) throw new Error('Job not found');

    const fleetRes = await this.pool.query("SELECT * FROM fleets WHERE id = $1", [job.fleet_id]);
    const fleet = fleetRes.rows[0];
    if (!fleet) throw new Error('Associated fleet not found');

    const accRes = await this.pool.query("SELECT * FROM github_accounts WHERE id = $1", [fleet.account_id]);
    const account = accRes.rows[0];
    if (!account) throw new Error('GitHub account credentials not found');

    const itemsRes = await this.pool.query(
      "SELECT * FROM fleet_job_items WHERE job_id = $1 AND status = 'FAILED'",
      [jobId]
    );
    const failedItems = itemsRes.rows;

    if (failedItems.length === 0) {
      return { success: true, message: 'No failed items to retry' };
    }

    const repoConfigs = failedItems.map(item => ({
      owner: account.owner,
      repo: item.repo_name,
      runner_count: fleet.runners_per_repo || 1
    }));

    const targetParams = dispatchParams || {
      stream_url: fleet.target_url || 'https://www.tiktok.com/@tiktok/live',
      duration_minutes: fleet.duration_minutes || 60,
      likes_per_minute: fleet.likes_per_minute || 180,
      runner_count: fleet.runners_per_repo || 1
    };

    this.startJob(jobId, fleet.id, account, repoConfigs, targetParams);
    return { success: true, retrying_count: failedItems.length };
  }

  /**
   * Reconciles orphaned jobs after server or PM2 restart
   */
  async recoverOrphanedJobs() {
    try {
      const query = `
        SELECT id, fleet_id, total_items, completed_items, failed_items
        FROM fleet_jobs
        WHERE status = 'IN_PROGRESS' OR status = 'PENDING'
      `;
      const res = await this.pool.query(query);
      if (res.rows.length === 0) return;

      console.log(`[FleetWorker] Reconciling ${res.rows.length} orphaned jobs from previous server session...`);
      for (const row of res.rows) {
        // Mark uncompleted items as interrupted
        await this.pool.query(`
          UPDATE fleet_job_items
          SET status = 'FAILED', step = 'INTERRUPTED', error_message = 'Interrupted by server restart. Ready to retry.'
          WHERE job_id = $1 AND status != 'COMPLETED'
        `, [row.id]);

        // Count final states
        const countRes = await this.pool.query(`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
            COUNT(*) FILTER (WHERE status = 'FAILED') as failed
          FROM fleet_job_items WHERE job_id = $1
        `, [row.id]);

        const completed = parseInt(countRes.rows[0]?.completed || 0);
        const failed = parseInt(countRes.rows[0]?.failed || 0);
        const finalStatus = completed === row.total_items ? 'COMPLETED' : (completed > 0 ? 'PARTIALLY_FAILED' : 'FAILED');

        await this.pool.query(`
          UPDATE fleet_jobs
          SET status = $1, completed_items = $2, failed_items = $3,
              error_message = 'Server restarted during execution. Failed items ready to retry.',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [finalStatus, completed, failed, row.id]);
      }
    } catch (err) {
      console.debug('[FleetWorker] Orphaned jobs recovery notice:', err.message);
    }
  }
}

module.exports = FleetWorker;
