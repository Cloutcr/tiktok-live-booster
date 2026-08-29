# FGOS / TikTok Live Booster: Master Implementation Plan

**Document Version:** 2.0.0  
**Date:** August 27, 2026  
**Reference Audits:** [`FGOS_ARCHITECTURE_AUDIT.md`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/FGOS_ARCHITECTURE_AUDIT.md), [`FGOS_DATA_FLOW.md`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/FGOS_DATA_FLOW.md)

---

## 1. Prioritization & Milestone Roadmap

To ensure rock-solid stability and zero regressions, implementation follows a strict phased rollout: **One completely verified runner must pass all criteria before multi-runner scaling.**

```
+---------------------------------------------------------------------------------------+
| MILESTONE 1: Single Android 14 Runner End-to-End Foundation (P0)                      |
| - Android 14 (API 34) AVD execution & runtime SDK validation                          |
| - Complete PostgreSQL Schema as Authoritative Single Source of Truth                  |
| - Deterministic Runner Registration & Heartbeat State Machine                         |
| - Verified ADB connectivity, display metrics, and native app launch                   |
+-------------------------------------------+-------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------+
| MILESTONE 2: Low-Latency Screen Streaming & Interactive Remote Control (P1)           |
| - Open-Source Headless Video Streaming (scrcpy-server / WebRTC / WS H.264)             |
| - Bidirectional Touch DataChannel (<100ms latency, exact resolution touch mapping)   |
| - In-App Authentication State Machine with challenge detection                        |
| - Google Sheets to SQL Background Synchronization Worker                              |
+-------------------------------------------+-------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------+
| MILESTONE 3: Multi-Runner Scaling & Production Reliability (P2 / P3)                  |
| - Matrix scaling (1 to 20 parallel AVDs across clusters)                              |
| - Watchdog disconnect detection & stale runner cleanup                                |
| - Structured observability, error logging, and resilient recovery                    |
+---------------------------------------------------------------------------------------+
```

---

## 2. P0: Single Android 14 Runner Core Foundation

### 2.1 Android 14 (API 34) Standardization
1. **GitHub Workflow & AVD Configuration:**
   - Update [`.github/workflows/tiktok-app-booster.yml`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/.github/workflows/tiktok-app-booster.yml):
     - Change `api-level: 34`.
     - Change `target: google_apis` (or `aosp_atd` for optimized headless cloud tests).
     - Update cache key to `avd-34-x86_64-v1`.
     - Enable KVM hardware acceleration with explicit validation check.
2. **Runtime Verification:**
   - In [`src/adb_controller.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/adb_controller.py), query properties at startup:
     ```python
     sdk_version = self.shell("getprop ro.build.version.sdk").strip()
     android_release = self.shell("getprop ro.build.version.release").strip()
     boot_completed = self.shell("getprop sys.boot_completed").strip()
     ```
   - If `sdk_version != "34"`, log an alert and report actual values to the backend.

### 2.2 Authoritative PostgreSQL Database Schema
Create the full relational schema in PostgreSQL on the Hetzner VM to replace in-memory maps:

```sql
-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. GitHub Cluster Accounts
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

-- 3. Operational TikTok Accounts (Synced from Google Sheets)
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

-- 4. Active Runners
CREATE TABLE IF NOT EXISTS runners (
    id SERIAL PRIMARY KEY,
    runner_key VARCHAR(100) UNIQUE NOT NULL, -- e.g. tiktok-live-booster_runner_0
    cluster_repo VARCHAR(255) NOT NULL,
    runner_index INTEGER NOT NULL,
    android_version VARCHAR(20) DEFAULT '14',
    sdk_level INTEGER DEFAULT 34,
    display_width INTEGER DEFAULT 1080,
    display_height INTEGER DEFAULT 2400,
    status VARCHAR(50) NOT NULL DEFAULT 'REGISTERING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Runner Sessions & Telemetry
CREATE TABLE IF NOT EXISTS runner_sessions (
    id SERIAL PRIMARY KEY,
    session_uuid VARCHAR(64) UNIQUE NOT NULL,
    runner_id INTEGER REFERENCES runners(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    workflow_run_id BIGINT,
    target_stream_url TEXT NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'INITIALIZING',
    likes_sent INTEGER NOT NULL DEFAULT 0,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_code VARCHAR(50),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 6. Remote Control Commands
CREATE TABLE IF NOT EXISTS commands (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES runner_sessions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, DELIVERED, EXECUTED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- 7. Structured Runner Logs
CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES runner_sessions(id) ON DELETE CASCADE,
    runner_key VARCHAR(100) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    state VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_runner_sessions_heartbeat ON runner_sessions(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
```

### 2.3 Deterministic Runner State Machine
Replace loose status strings in [`src/main.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/main.py) with formal lifecycle states:

```python
class RunnerState(str, Enum):
    INITIALIZING = "INITIALIZING"
    ADB_CONNECTED = "ADB_CONNECTED"
    ANDROID_BOOTED = "ANDROID_BOOTED"
    REGISTERED = "REGISTERED"
    APP_STARTED = "APP_STARTED"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTHENTICATED = "AUTHENTICATED"
    TARGET_OPENING = "TARGET_OPENING"
    TARGET_VERIFIED = "TARGET_VERIFIED"
    RUNNING = "RUNNING"
    RECOVERING = "RECOVERING"
    STOPPED = "STOPPED"
    ERROR = "ERROR"
```

---

## 3. P1: Real-Time Remote Screen & Interactive Control

### 3.1 Headless Screen Streaming Architecture
* **Technology Choice:** `scrcpy-server` binary deployed directly to `/data/local/tmp/scrcpy-server.jar` + lightweight Node.js/Python WebSocket H.264 stream forwarder.
* **Why this approach?**
  - Works 100% headlessly on Linux without X11/Xvfb.
  - Captures hardware-accelerated H.264 video directly from Android's MediaCodec.
  - Latency: **<150ms** (vs current 3,000ms+ PNG slideshow).
  - Bandwidth: **~400 Kbps** for smooth 30 FPS video.
* **Touch Data Channel:**
  - WebSocket / WebRTC DataChannel receives pointer coordinates directly and writes binary touch packets into `scrcpy-server` control socket for sub-30ms touch responsiveness.

### 3.2 Dynamic Resolution & Orientation Mapping
In the frontend [`frontend/src/App.jsx`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/frontend/src/App.jsx):
- Query `display_width` and `display_height` from the runner record in SQL.
- Compute scaling:
  ```javascript
  const scaleX = deviceWidth / viewportRect.width;
  const scaleY = deviceHeight / viewportRect.height;
  const adbX = Math.round((event.clientX - viewportRect.left) * scaleX);
  const adbY = Math.round((event.clientY - viewportRect.top) * scaleY);
  ```

---

## 4. P1: Google Sheets to SQL Synchronization Worker

* **Sync Service (`backend/sync_service.js` or `scripts/sync_sheets.py`):**
  - Runs every 60 seconds or on-demand via `POST /api/accounts/sync`.
  - Authenticates with Google Sheets API, reads inventory, and executes an atomic `UPSERT` into the PostgreSQL `accounts` table.
  - Runners read exclusively from PostgreSQL, making them 100% resilient against Google API outages.

---

## 5. P2: Multi-Runner Scaling & Failure Recovery

### 5.1 Watchdog & Stale Runner Disconnect Detection
* Backend background cron runs every 5 seconds:
  ```sql
  UPDATE runner_sessions 
  SET state = 'DISCONNECTED', ended_at = CURRENT_TIMESTAMP 
  WHERE state NOT IN ('STOPPED', 'COMPLETED', 'DISCONNECTED') 
    AND last_heartbeat < (CURRENT_TIMESTAMP - INTERVAL '15 SECONDS');
  ```
* Eliminates ghost/stale runners from the UI dashboard.

### 5.2 Failure Recovery Protocols
| Failure Event | Detection Mechanism | Automated Recovery Action |
| :--- | :--- | :--- |
| **ADB Disconnect** | `adb get-state` returns non-zero | Restart ADB server (`adb kill-server && adb start-server`), reconnect socket. |
| **App Crash / ANR** | Foreground activity is not TikTok | Inspect UI for ANR ("Wait"/"Close"), kill package (`am force-stop`), relaunch live intent. |
| **Stream Drop** | Video element missing for > 20s | Re-issue `snssdk1233://live?room_id=...` intent with exponential backoff (max 3 retries). |
| **Backend Unreachable** | HTTP 5xx / Network timeout | Runner buffers telemetry locally for up to 30s, continues liking stream uninterrupted. |

---

## 6. Verification & Smoke Test Protocol

For Milestone 1 verification, the following smoke test must pass:

1. [ ] **Workflow Launch:** GitHub Actions workflow launches with `api-level: 34`.
2. [ ] **OS & SDK Verification:** Runner validates `ro.build.version.sdk == 34` and `sys.boot_completed == 1`.
3. [ ] **SQL Registration:** `POST /api/runners/register` creates record in `runners` and `runner_sessions`.
4. [ ] **Heartbeat Stream:** Heartbeats update `last_heartbeat` in SQL every 2.5s with deterministic state.
5. [ ] **Live Screen Video:** Browser connects to live stream; video renders at >= 20 FPS with < 200ms latency.
6. [ ] **Interactive Touch:** User clicks screen in browser; touch ripples, and Android device reflects touch immediately.
7. [ ] **Navigation Controls:** Back, Home, and App Switcher buttons respond with real-time UI reaction.
8. [ ] **Clean Termination:** Clicking "Stop" marks session as `STOPPED` in SQL and closes workflow gracefully.
