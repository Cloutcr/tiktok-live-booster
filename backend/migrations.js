/**
 * FGOS / TikTok Live Booster: PostgreSQL Migration Runner
 * Creates all required relational tables for Milestone 1 and beyond.
 */

const { Pool } = require('pg');

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    console.log('[Postgres Migration] Starting database schema verification...');
    await client.query('BEGIN');

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'operator',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. GitHub Cluster Accounts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_accounts (
        id SERIAL PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        token TEXT NOT NULL,
        max_runners INTEGER NOT NULL DEFAULT 5,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Operational TikTok Accounts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        external_id VARCHAR(100),
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT,
        cookies_raw TEXT,
        session_backup_url TEXT,
        device_id VARCHAR(64),
        proxy TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
        last_active TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Active Hardware & Cloud Runners Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS runners (
        id SERIAL PRIMARY KEY,
        runner_key VARCHAR(100) UNIQUE NOT NULL,
        cluster_repo VARCHAR(255) NOT NULL,
        runner_index INTEGER NOT NULL,
        android_version VARCHAR(20) DEFAULT '14',
        sdk_level INTEGER DEFAULT 34,
        display_width INTEGER DEFAULT 1080,
        display_height INTEGER DEFAULT 2400,
        display_density INTEGER DEFAULT 420,
        status VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Runner Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS runner_sessions (
        id SERIAL PRIMARY KEY,
        session_uuid VARCHAR(64) UNIQUE NOT NULL,
        runner_id INTEGER REFERENCES runners(id) ON DELETE CASCADE,
        account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        workflow_run_id BIGINT,
        target_stream_url TEXT,
        state VARCHAR(50) NOT NULL DEFAULT 'INITIALIZING',
        likes_sent INTEGER NOT NULL DEFAULT 0,
        elapsed_seconds INTEGER NOT NULL DEFAULT 0,
        package_name VARCHAR(255) DEFAULT 'com.zhiliaoapp.musically',
        foreground_activity TEXT,
        adb_state VARCHAR(50) DEFAULT 'OK',
        app_state VARCHAR(50) DEFAULT 'RUNNING',
        screen_state VARCHAR(50) DEFAULT 'STREAMING',
        control_state VARCHAR(50) DEFAULT 'CONNECTED',
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        error_code VARCHAR(50),
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // 6. Runner Heartbeats History Table (for analytics and time-series telemetry)
    await client.query(`
      CREATE TABLE IF NOT EXISTS runner_heartbeats (
        id BIGSERIAL PRIMARY KEY,
        session_uuid VARCHAR(64) NOT NULL,
        runner_key VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        likes_sent INTEGER NOT NULL DEFAULT 0,
        elapsed_seconds INTEGER NOT NULL DEFAULT 0,
        foreground_activity TEXT,
        screenshot_b64 TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Remote Control Commands Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS runner_commands (
        id SERIAL PRIMARY KEY,
        session_uuid VARCHAR(64) NOT NULL,
        runner_key VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP WITH TIME ZONE,
        executed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT
      );
    `);

    // 8. Structured Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS runner_logs (
        id BIGSERIAL PRIMARY KEY,
        session_uuid VARCHAR(64) NOT NULL,
        runner_key VARCHAR(100) NOT NULL,
        level VARCHAR(20) NOT NULL DEFAULT 'INFO',
        state VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. GitHub Fleets Grouping Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        account_id INTEGER REFERENCES github_accounts(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        target_url TEXT,
        duration_minutes INTEGER DEFAULT 60,
        likes_per_minute INTEGER DEFAULT 180,
        runners_per_repo INTEGER DEFAULT 1,
        total_repos INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Fleet Repositories Table (Supports 100-500+ repositories)
    await client.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,
        fleet_id INTEGER REFERENCES fleets(id) ON DELETE SET NULL,
        account_id INTEGER REFERENCES github_accounts(id) ON DELETE CASCADE,
        owner VARCHAR(255) NOT NULL,
        repo VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'READY',
        workflow_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        dispatch_status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
        runner_count INTEGER NOT NULL DEFAULT 1,
        last_workflow_run_id BIGINT,
        error_message TEXT,
        last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_owner_repo UNIQUE(owner, repo)
      );
    `);

    // 11. Fleet Asynchronous Background Jobs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleet_jobs (
        id SERIAL PRIMARY KEY,
        fleet_id INTEGER REFERENCES fleets(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 12. Fleet Job Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleet_job_items (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES fleet_jobs(id) ON DELETE CASCADE,
        repo_name VARCHAR(255) NOT NULL,
        step VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 13. Runner State Transitions History Table (Authoritative Audit Log)
    await client.query(`
      CREATE TABLE IF NOT EXISTS runner_state_transitions (
        id SERIAL PRIMARY KEY,
        runner_key VARCHAR(100) NOT NULL,
        session_uuid VARCHAR(100),
        from_state VARCHAR(50),
        to_state VARCHAR(50) NOT NULL,
        reason TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indices for ultra-fast lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_runner_sessions_uuid ON runner_sessions(session_uuid);
      CREATE INDEX IF NOT EXISTS idx_runner_sessions_heartbeat ON runner_sessions(last_heartbeat);
      CREATE INDEX IF NOT EXISTS idx_runner_commands_status ON runner_commands(status, runner_key);
      CREATE INDEX IF NOT EXISTS idx_runner_logs_session ON runner_logs(session_uuid);
      CREATE INDEX IF NOT EXISTS idx_repositories_fleet ON repositories(fleet_id);
      CREATE INDEX IF NOT EXISTS idx_repositories_account ON repositories(account_id);
      CREATE INDEX IF NOT EXISTS idx_repositories_owner_repo ON repositories(owner, repo);
      CREATE INDEX IF NOT EXISTS idx_repositories_status ON repositories(status);
      CREATE INDEX IF NOT EXISTS idx_fleet_jobs_status ON fleet_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_fleet_job_items_job ON fleet_job_items(job_id);
      CREATE INDEX IF NOT EXISTS idx_runner_transitions_key ON runner_state_transitions(runner_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_runner_transitions_session ON runner_state_transitions(session_uuid);
    `);

    await client.query('COMMIT');
    console.log('[Postgres Migration] All tables and indices verified successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Postgres Migration] Schema migration notice:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
