/**
 * Comprehensive Scalability and Load Benchmark Suite
 * Measures throughput, API rates, queue depth, DB connections, memory, and WebSocket rates
 * across 1, 3, 10, 100, and 500 repository scales.
 */

const GitHubClient = require('../backend/github_client');
const FleetWorker = require('../backend/fleet_worker');

// Mock Pool for High-Scale Simulation & Metrics Tracking
class MockDatabasePool {
  constructor(maxConnections = 30) {
    this.maxConnections = maxConnections;
    this.activeConnections = 0;
    this.peakConnections = 0;
    this.queryCount = 0;
    this.jobs = new Map();
    this.jobItems = new Map();
    this.repositories = new Map();
  }

  async query(sql, params = []) {
    this.queryCount++;
    this.activeConnections++;
    if (this.activeConnections > this.peakConnections) {
      this.peakConnections = this.activeConnections;
    }

    // Simulate DB I/O latency (0.5ms - 2ms)
    await new Promise(r => setImmediate(r));

    try {
      if (sql.includes('UPDATE fleet_jobs')) {
        return { rowCount: 1 };
      }
      if (sql.includes('UPDATE fleet_job_items')) {
        return { rowCount: 1 };
      }
      if (sql.includes('INSERT INTO repositories') || sql.includes('UPDATE repositories')) {
        return { rowCount: 1 };
      }
      if (sql.includes('SELECT') && sql.includes('fleet_job_items')) {
        return { rows: [{ completed: params[0] || 0, failed: 0 }] };
      }
      return { rows: [], rowCount: 1 };
    } finally {
      this.activeConnections--;
    }
  }
}

// Mock GitHub Client for Load Testing Rate Limits & Throughput
class BenchmarkGitHubClient extends GitHubClient {
  constructor(token, options = {}) {
    super(token);
    this.mockLatencyMs = options.mockLatencyMs || 5;
    this.apiCallCount = 0;
    this.startTime = Date.now();
  }

  async _request(endpoint, options = {}, retries = 2) {
    this.apiCallCount++;
    await new Promise(r => setTimeout(r, this.mockLatencyMs));

    if (endpoint === '/user') {
      return {
        status: 200,
        headers: new Headers({ 'x-oauth-scopes': 'repo, workflow', 'x-ratelimit-remaining': '4990' }),
        data: { id: 12345, login: 'benchmark-user', total_private_repos: 50 }
      };
    }
    if (endpoint.includes('/actions/workflows/')) {
      return { status: 200, headers: new Headers(), data: { state: 'active' } };
    }
    if (endpoint.includes('/actions/runs')) {
      return { status: 200, headers: new Headers(), data: { workflow_runs: [{ id: 99991, status: 'in_progress' }] } };
    }
    return { status: 200, headers: new Headers(), data: { id: 100, full_name: 'test/repo' } };
  }

  async createRepository(repoName) {
    this.apiCallCount++;
    await new Promise(r => setTimeout(r, this.mockLatencyMs));
    return { name: repoName, full_name: `benchmark-user/${repoName}` };
  }

  async pushRunnerFiles(owner, repo) {
    this.apiCallCount += 5; // Simulates tree, commit, ref updates
    await new Promise(r => setTimeout(r, this.mockLatencyMs * 2));
    return { success: true, commit_sha: 'abc1234' };
  }

  async dispatchWorkflow(owner, repo, workflowFile, inputs) {
    this.apiCallCount++;
    await new Promise(r => setTimeout(r, this.mockLatencyMs));
    return { success: true };
  }

  async cancelRun(owner, repo, runId) {
    this.apiCallCount++;
    await new Promise(r => setTimeout(r, this.mockLatencyMs));
    return { success: true };
  }
}

// WebSocket broadcast rate tracker
class WebSocketMetricsTracker {
  constructor() {
    this.messageCount = 0;
    this.messagesPerType = {};
  }

  broadcast(eventType, payload) {
    this.messageCount++;
    this.messagesPerType[eventType] = (this.messagesPerType[eventType] || 0) + 1;
  }
}

async function runScaleBenchmark(scaleName, repoCount, concurrency) {
  console.log(`\n======================================================`);
  console.log(`  BENCHMARK: ${scaleName} (${repoCount} Repositories, Concurrency: ${concurrency})`);
  console.log(`======================================================`);

  const mockDb = new MockDatabasePool(30);
  const wsTracker = new WebSocketMetricsTracker();
  const worker = new FleetWorker(mockDb, (t, p) => wsTracker.broadcast(t, p), concurrency);

  const ghClient = new BenchmarkGitHubClient('ghp_dummy_benchmark_token_123456789', { mockLatencyMs: 2 });
  
  // Inject mock client factory
  worker._createClient = () => ghClient;

  const repoConfigs = [];
  for (let i = 1; i <= repoCount; i++) {
    const pad = String(i).padStart(3, '0');
    repoConfigs.push({
      owner: 'benchmark-user',
      repo: `tiktok-live-booster-fleet-${pad}`,
      runner_count: 1
    });
  }

  const startMem = process.memoryUsage();
  const startTime = Date.now();

  // Run the batch job directly
  const abortController = new AbortController();
  await worker._processJob(
    100 + repoCount,
    1,
    { token: 'ghp_dummy_benchmark_token_123456789', owner: 'benchmark-user' },
    repoConfigs,
    { stream_url: 'https://www.tiktok.com/@tiktok/live', duration_minutes: 60, likes_per_minute: 180, runner_count: 1 },
    abortController.signal
  );

  const durationMs = Date.now() - startTime;
  const durationSec = durationMs / 1000;
  const endMem = process.memoryUsage();

  const throughputReposPerSec = (repoCount / durationSec).toFixed(2);
  const apiRequestsPerMin = Math.round((ghClient.apiCallCount / durationSec) * 60);
  const memoryDeltaMb = ((endMem.heapUsed - startMem.heapUsed) / (1024 * 1024)).toFixed(2);
  const heapUsedMb = (endMem.heapUsed / (1024 * 1024)).toFixed(2);

  console.log(`⏱️ Completion Time:         ${durationMs}ms (${durationSec.toFixed(2)}s)`);
  console.log(`⚡ Repo Throughput:          ${throughputReposPerSec} repos/sec`);
  console.log(`🌐 GitHub API Calls:         ${ghClient.apiCallCount} total (${apiRequestsPerMin} req/min)`);
  console.log(`🗄️ Database Queries:         ${mockDb.queryCount} total (Peak DB Conns: ${mockDb.peakConnections}/${mockDb.maxConnections})`);
  console.log(`📡 WebSocket Messages:       ${wsTracker.messageCount} broadcast events`);
  console.log(`🧠 Memory (Heap Used):       ${heapUsedMb} MB (Delta: ${memoryDeltaMb} MB)`);

  return {
    scaleName,
    repoCount,
    durationMs,
    durationSec,
    throughputReposPerSec,
    apiRequestsPerMin,
    apiCallCount: ghClient.apiCallCount,
    dbQueries: mockDb.queryCount,
    peakDbConns: mockDb.peakConnections,
    wsMessages: wsTracker.messageCount,
    heapUsedMb
  };
}

// Stop All Parallel Cancellation Benchmark
async function runStopAllBenchmark(repoCount, concurrency = 15) {
  console.log(`\n------------------------------------------------------`);
  console.log(`  STOP ALL BENCHMARK: ${repoCount} Repositories (Concurrency: ${concurrency})`);
  console.log(`------------------------------------------------------`);

  const ghClient = new BenchmarkGitHubClient('ghp_dummy_benchmark_token_123456789', { mockLatencyMs: 2 });
  const repos = [];
  for (let i = 1; i <= repoCount; i++) {
    repos.push({
      owner: 'benchmark-user',
      repo: `repo-${i}`,
      token: 'ghp_dummy_benchmark_token_123456789'
    });
  }

  const startTime = Date.now();
  
  // Parallel cancellation
  let totalCancelled = 0;
  const queue = [...repos];
  let index = 0;

  const worker = async () => {
    while (index < queue.length) {
      const r = queue[index++];
      if (!r) continue;
      const activeRuns = await ghClient.listActiveRuns(r.owner, r.repo);
      for (const run of activeRuns) {
        await ghClient.cancelRun(r.owner, r.repo, run.id);
        totalCancelled++;
      }
    }
  };

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, repos.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const durationMs = Date.now() - startTime;
  const durationSec = durationMs / 1000;
  console.log(`⏱️ Cancel All Duration:      ${durationMs}ms (${durationSec.toFixed(2)}s)`);
  console.log(`⚡ Cancel Throughput:        ${(repoCount / durationSec).toFixed(2)} repos/sec`);
  console.log(`🛑 Total Workflows Stopped:  ${totalCancelled}`);

  return { repoCount, durationMs, durationSec, totalCancelled };
}

async function main() {
  console.log('🚀 STARTING COMPREHENSIVE GITHUB FLEET SCALABILITY LOAD TEST SUITE');

  const results = [];
  results.push(await runScaleBenchmark('Scale 1 (Single Repo)', 1, 3));
  results.push(await runScaleBenchmark('Scale 3 (Small Fleet)', 3, 3));
  results.push(await runScaleBenchmark('Scale 10 (Medium Fleet)', 10, 5));
  results.push(await runScaleBenchmark('Scale 100 (Enterprise Fleet)', 100, 10));
  results.push(await runScaleBenchmark('Scale 500 (Massive Fleet Stress)', 500, 15));

  console.log('\n======================================================');
  console.log('  BENCHMARKING STOP ALL SCALABILITY (100 & 500 Repos)');
  console.log('======================================================');
  const stop100 = await runStopAllBenchmark(100, 15);
  const stop500 = await runStopAllBenchmark(500, 20);

  console.log('\n======================================================');
  console.log('  FINAL SCALABILITY BENCHMARK SUMMARY REPORT');
  console.log('======================================================');
  console.table(results.map(r => ({
    'Scale': r.scaleName,
    'Repos': r.repoCount,
    'Time (s)': `${r.durationSec.toFixed(2)}s`,
    'Throughput (repos/s)': r.throughputReposPerSec,
    'API Calls': r.apiCallCount,
    'Peak DB Conns': `${r.peakDbConns}/30`,
    'Heap (MB)': `${r.heapUsedMb} MB`
  })));

  console.log(`\n✓ Stop All on 100 repos: ${stop100.durationMs}ms (${stop100.totalCancelled} runs cancelled)`);
  console.log(`✓ Stop All on 500 repos: ${stop500.durationMs}ms (${stop500.totalCancelled} runs cancelled)`);
  console.log('\n🎉 ALL SCALABILITY AUDIT & LOAD TESTS COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
