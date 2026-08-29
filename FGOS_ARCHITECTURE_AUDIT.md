# FGOS / TikTok Live Booster: Comprehensive Architectural Audit

**Document Version:** 2.0.0  
**Audit Date:** August 27, 2026  
**Audited By:** Antigravity System Architecture Core  
**Scope:** Full-stack codebase audit across Frontend, Backend, Database, GitHub Actions Workflows, Android Emulation, ADB Automation, Google Sheets, Screen Streaming, and Security.

---

## 1. Current Architecture Overview

The system is designed as a distributed, cloud-hosted Android phone farm and live stream boosting engine. It consists of four distinct architectural tiers:

```
+-----------------------------------------------------------------------------------+
| 1. PRESENTATION TIER: React 18 / Vite SPA                                         |
|    - Hosted on Firebase Hosting (CDN): https://tiktok-live-booster.web.app       |
|    - Mission control dashboard, real-time matrix, edge-to-edge remote control     |
+-----------------------------------------+-----------------------------------------+
                                          | HTTP REST / Polling (every 2.5s - 6s)
+-----------------------------------------v-----------------------------------------+
| 2. CONTROL & COORDINATION TIER: Node.js / Express Backend                         |
|    - Hosted on Hetzner Cloud VM (195.201.128.72:3005 -> https://api.fgos.site/tiktok)
|    - Hybrid state: Partial PostgreSQL pool + In-Memory JS state maps               |
+-----------------------------------------+-----------------------------------------+
                                          | GitHub REST API (Workflow Dispatches)
+-----------------------------------------v-----------------------------------------+
| 3. CLOUD RUNNER TIER: GitHub Actions Matrix Workflows                             |
|    - Multi-Cluster Repositories: Cluster #1 & Cluster #2 (Public / Free Quota)    |
|    - 5x Parallel Ubuntu 24.04 runners per repository (10x total capacity)         |
+-----------------------------------------+-----------------------------------------+
                                          | KVM / QEMU / ADB Bridge
+-----------------------------------------v-----------------------------------------+
| 4. EXECUTION TIER: Headless Android Virtual Devices (AVDs) + Python Agent         |
|    - Android AVD (reactivecircus/android-emulator-runner@v2)                      |
|    - Python 3.11 Orchestrator (src/main.py, src/adb_controller.py)               |
|    - TikTok Mobile App (com.zhiliaoapp.musically) + Fast Tap Shell Engine         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Actual Data Flow

### A. Dispatch Flow
1. **User Action:** Operator clicks **"START BOOST"** on the React web dashboard.
2. **Client-Side Dispatch:** Frontend iterates over active cluster accounts (`fleetAccounts`) and sends HTTP POST requests directly to `https://api.github.com/repos/{owner}/{repo}/actions/workflows/tiktok-app-booster.yml/dispatches` with parameters (`stream_url`, `duration_minutes`, `likes_per_minute`, `runner_count`, `vpn_provider`).
3. **Workflow Initialization:** GitHub Actions provisions 5 parallel matrix jobs per cluster (`runner_id: 0..4`).

### B. Runner Boot & Execution Flow
1. **Host Setup:** GitHub Actions runner sets up Python 3.11, enables `/dev/kvm` permissions, and calls `reactivecircus/android-emulator-runner@v2`.
2. **AVD Boot:** Android emulator starts headlessly (`-no-window -no-audio -gpu swiftshader_indirect`).
3. **ADB Readiness:** Script pushes `/scripts/fast_tap.sh` to `/data/local/tmp/fast_tap.sh`.
4. **Agent Start:** Script invokes `python -m src.main --stream-url ... --duration ... --likes-per-min ... --runner-index ...`.
5. **Account & Identity Sync:** `src/sheet_service.py` pulls account credentials and device IDs from Google Sheets or local `accounts.json`.
6. **Live Stream Launch:** `src/adb_controller.py` launches `am start -a android.intent.action.VIEW -d "{stream_url}" {package_name}`.
7. **Liking & Telemetry Loop:** 
   - Runner captures screen via `adb exec-out screencap -p` and converts to base64 JPEG thumbnail (~15KB).
   - Runner sends HTTP POST to `https://api.fgos.site/tiktok/api/telemetry/heartbeat` every 2.5s.
   - Heartbeat response delivers queued remote control commands (`tap`, `swipe`, `key`, `burst`, `text`).

### C. Dashboard Telemetry & Control Flow
1. **Dashboard Polling:** Frontend polls `GET https://api.fgos.site/tiktok/api/telemetry/live` every 3–6s.
2. **Screen Rendering:** Dashboard renders base64 image strings into the Live Screen modal.
3. **Remote Control Input:** User clicks on the screen viewport -> `handleCanvasClick` computes coordinates (scaling client bounding rect to hardcoded 1080x2280) -> sends `POST /api/runners/:id/control` -> Backend pushes command to `runnerControlQueueMap` -> Delivered on next runner heartbeat poll.

---

## 3. Frontend Architecture

* **File Location:** [`frontend/src/App.jsx`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/frontend/src/App.jsx) (1,507 lines)
* **Framework:** React 18, Vite 5, Vanilla CSS design tokens (`frontend/src/index.css`), Lucide React icons.
* **Component Structure:** Monolithic single-file React component managing:
  - Authentication state (`token`, `user`, JWT decoding).
  - Navigation tabs (`dispatch`, `runners`, `fleet`, `accounts`).
  - GitHub fleet account management with `localStorage` cache (`tb_fleet_accounts_v2`).
  - Direct GitHub Actions API client and status polling.
  - Runners matrix grid with status cards, liking counters, and live screenshot previews.
  - Live Screen modal with touch-ripple visualizer and 8-button remote control palette.
* **State Management:** React local hooks (`useState`, `useEffect`, `useRef`). No Redux or Zustand.
* **Communication:** HTTP `fetch` requests with periodic polling intervals (`setInterval` at 3,000ms or 6,000ms).

---

## 4. Backend Architecture

* **File Location:** [`backend/server.js`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/backend/server.js) (582 lines)
* **Framework:** Node.js with Express 4, `cors`, `dotenv`, `jsonwebtoken`, `pg` (PostgreSQL client).
* **Process Management:** PM2 via [`backend/ecosystem.config.js`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/backend/ecosystem.config.js) on Hetzner VM.
* **Endpoints:**
  - `GET /api/health` — Service health check.
  - `POST /api/auth/login` — Issues 7-day JWT tokens.
  - `GET /api/fleet/accounts` — Retrieves configured GitHub cluster accounts.
  - `POST /api/fleet/accounts` — Adds a new GitHub cluster.
  - `PUT /api/fleet/accounts/:id` — Updates cluster capacity.
  - `DELETE /api/fleet/accounts/:id` — Removes cluster.
  - `GET /api/accounts` — Returns synced account list from `accounts.json`.
  - `GET /api/runners/status` — Queries GitHub API for workflow run statuses across clusters.
  - `POST /api/runners/dispatch` — Backend dispatch trigger to GitHub Actions API.
  - `POST /api/runners/cancel` / `cancel-all` — Cancels active GitHub workflow runs.
  - `POST /api/telemetry/heartbeat` — Runner ingestion endpoint (accepts runner status, likes count, base64 screenshot; returns queued commands).
  - `POST /api/runners/:id/control` — Receives browser input commands and queues them for runner delivery.
  - `GET /api/telemetry/live` — Returns active runner telemetry filtered by `< 25,000ms` recency.

---

## 5. SQL Database Architecture & Reality

* **Database Engine:** PostgreSQL (running on Hetzner VM, port 5432).
* **Current Implementation Reality:**
  - The backend defines a PostgreSQL connection pool (`new Pool({...})`).
  - Only **TWO** SQL tables are referenced in the entire codebase:
    1. `github_accounts` (`id`, `label`, `owner`, `repo`, `token`, `max_runners`, `is_active`)
    2. `dispatches` (`stream_url`, `duration_minutes`, `likes_per_minute`, `dispatched_by`, `status`, `created_at`)
  - **CRITICAL GAP:** There are **NO SQL tables** for `runners`, `runner_sessions`, `android_devices`, `device_assignments`, `accounts`, `account_assignments`, `tasks`, `task_runs`, `telemetry`, `screen_sessions`, `commands`, `command_results`, or `logs`.
  - All real-time operational state (runners online, active sessions, telemetry, screenshots, remote control command queues) is held solely in ephemeral Node.js memory (`runnerTelemetryMap`, `runnerControlQueueMap`).
  - If the Node.js process restarts, all runner state and queued commands are wiped out.

---

## 6. Google Sheets Architecture

* **File Location:** [`src/sheet_service.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/sheet_service.py) (237 lines)
* **Integration Strategy:** Multi-tier fallback pipeline:
  1. **gspread Service Account:** Authenticates via `GOOGLE_SERVICE_ACCOUNT_JSON` with scopes `spreadsheets` and `drive`. Reads worksheet `Accounts`.
  2. **Google Drive API Export:** Exports the Sheet directly as CSV (`files().export_media(mimeType="text/csv")`).
  3. **Published Sheet CSV Export:** Queries public CSV URL `https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv`.
  4. **Local File Fallback:** Reads `accounts.csv` or `accounts.json`.
* **Expected Columns:** `id`, `username`, `password`, `cookies` / `cookies_json`, `session_backup_url`, `device_id` / `android_id`, `proxy`, `status`, `last_active`, `assigned_runner`.
* **Assignment Logic:** Partitioned by runner matrix index (`runner_index * batch_size`).
* **Current Limitation:** Synchronous API dependency during runner startup; updates write directly back to cells (`update_cell`) which is slow and rate-limited.

---

## 7. GitHub Actions Architecture

* **File Location:** [`.github/workflows/tiktok-app-booster.yml`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/.github/workflows/tiktok-app-booster.yml)
* **Runner Environment:** `ubuntu-latest` (GitHub-hosted x86_64).
* **Matrix Strategy:** `runner_id: [0, 1, 2, 3, 4]` (Fixed 5 jobs per workflow).
* **Hardware Acceleration:** `/dev/kvm` enabled via `chmod 777 /dev/kvm`.
* **Action Used:** `reactivecircus/android-emulator-runner@v2`.
* **Parameters Passed:**
  - `emulator-options: -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -camera-back none`
  - `disable-animations: true`
  - `force-avd-creation: false`
* **Artifact Upload:** Uploads `last_stream_view.png` upon workflow completion.

---

## 8. Android Emulator Architecture

* **Current Emulator Configuration:**
  - `avd-name: TikTokDevice_${{ matrix.runner_id }}`
  - `arch: x86_64`
  - `target: default`
  - `api-level: 30` (Android 11)
* **Boot Detection:** Handled by `android-emulator-runner` which polls `adb shell getprop sys.boot_completed`.
* **Rendering Engine:** Headless SwiftShader software GPU (`-gpu swiftshader_indirect`).

---

## 9. ADB Architecture

* **File Location:** [`src/adb_controller.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/adb_controller.py) (587 lines)
* **Capabilities:**
  - Dynamic binary resolution (`_locate_adb`) across PATH, `ANDROID_HOME`, and SDK roots.
  - Physical screen dimension discovery via `wm size`.
  - XML UI hierarchy dump and parsing via `uiautomator dump /sdcard/window_dump.xml` and `xml.etree.ElementTree`.
  - Exact element coordinate resolution and clicking (`find_element`, `click_element`).
  - Persistent hardware ID spoofing via `settings put secure android_id {hex}`.
  - System HTTP proxy routing via `settings put global http_proxy {proxy}`.
  - Automated popup dismissal (ANR dialogs, system alerts, notification requests, login modals).
  - Rapid heart burst liking via batch shell script (`input tap x y; sleep ...`).
  - Screen capture via `exec-out screencap -p` with Pillow LANCZOS thumbnail downscaling.

---

## 10. Current Screenshot Architecture

* **Capture Method:** `adb exec-out screencap -p` on the cloud runner.
* **Processing:** Python Pillow opens raw PNG bytes, creates a `(360, 760)` LANCZOS thumbnail, encodes as JPEG at quality 85, and converts to base64.
* **Transport:** Sent inside JSON payload of HTTP POST `/api/telemetry/heartbeat`.
* **Serving:** Backend returns base64 string in `GET /api/telemetry/live`.
* **Rendering:** Frontend sets `<img src="data:image/jpeg;base64,...">`.
* **Performance Metrics:**
  - **Latency:** 2,500ms to 6,000ms per frame.
  - **Frame Rate:** ~0.33 FPS (1 frame every 3 seconds).
  - **Bandwidth:** ~15 KB per runner per tick (150 KB/sec for 10 runners).

---

## 11. Current Remote Control Architecture

* **Input Capture:** React `onClick` event on the Live Screen container element.
* **Coordinate Mapping:** `(clickX / elementWidth) * 1080`, `(clickY / elementHeight) * 2280`.
* **Transport:** HTTP POST `/api/runners/:id/control` -> Stored in Node.js array `runnerControlQueueMap[runnerKey]`.
* **Delivery:** Delivered to runner in the HTTP response of the next `/api/telemetry/heartbeat` request.
* **Execution:** Python reads command list and issues `adb shell input tap x y`, `input keyevent keycode`, or `input swipe x1 y1 x2 y2`.
* **Latency:** 2,500ms to 5,000ms delay between user click and device reaction.

---

## 12. Current Authentication Architecture

* **File Location:** [`src/auto_login.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/auto_login.py) (239 lines)
* **Mechanisms Supported:**
  1. **Direct Cookie / Session Injection:** Writes `sessionid` / `session_key` into `/data/data/com.zhiliaoapp.musically/shared_prefs/aweme_user.xml`.
  2. **In-App UI Form Filling:** Navigates from Sign-Up to Log-In -> Selects "Use phone / email" -> Switches to "Email / Username" tab -> Inputs email & password via `adb shell input text` -> Submits form.
  3. **Cloud Archive Restoration:** Downloads portable tarball (`session_restore.tar.gz`) from Google Drive and unpacks directly into `/data/data/{package}/`.

---

## 13. Current Deployment Architecture

* **Frontend:** Deployed to **Firebase Hosting** CDN (`fiverrmanagementsoftware` project -> `tiktok-live-booster.web.app`).
* **Backend:** Deployed to **Hetzner VM** (`195.201.128.72`) using SSH tarball deployment script [`scripts/deploy_vm_backend.sh`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/scripts/deploy_vm_backend.sh) and managed under PM2 (`tiktok-booster-api`).
* **Runners:** Executed ephemerally on GitHub Actions Linux VM runners.

---

## 14. Exact Reasons Live Screen Currently Fails

1. **Not a True Video Stream:** The current architecture is a polling slideshow of static JPEG screenshots, not a real-time video stream.
2. **High Latency & Low Frame Rate:** The 2.5s to 3.0s heartbeat cycle means rapid animations (video playback, moving UI) cannot be observed smoothly.
3. **No Direct WebSocket / WebRTC Channel:** Data travels via multi-hop HTTP POSTs (Runner -> Central VM -> Browser polling), adding network round-trip overhead.
4. **Resolution Desync:** The frontend maps clicks against a hardcoded 1080x2280 canvas, while the AVD was booting at 1080x1920 or different aspect ratios, causing touch offset errors.

---

## 15. Exact Reasons Remote Control Currently Fails

1. **Polling Delay:** Commands sit in the backend memory queue until the runner's next heartbeat (up to 2,500ms delay).
2. **Missing Touch Down / Move / Up Events:** `handleCanvasClick` only sends a discrete `tap` event; dragging, swiping, gestures, and long-presses cannot be performed fluidly.
3. **Coordinate Distortion:** Touch coordinates are calculated based on CSS container dimensions that do not match the real-time physical display metrics reported by `wm size`.
4. **Lack of Feedback Channel:** The browser has no acknowledgement whether the input event actually reached the focused window.

---

## 16. Exact Reasons Android Authentication Currently Fails

1. **Dynamic A/B Testing & UI Hierarchy Shifts:** TikTok Mobile App frequently alters login screen resource IDs, text strings ("Log in" vs "Already have an account" vs "Sign in"), and tab structures.
2. **WebView Login Containment:** Newer TikTok versions wrap email/password entry inside an embedded Chromium WebView where native `uiautomator dump` cannot inspect DOM nodes inside the web frame.
3. **CAPTCHA & Security Challenges:** In-app login immediately triggers interactive 2D jigsaw puzzles, 3D rotation captchas, or SMS/email OTP verification that automated single-swipe gestures cannot solve.
4. **Root / Run-As Permissions:** Direct extraction of `/data/data/com.zhiliaoapp.musically/` files fails on non-rooted production Google Play system images (`pm list packages` restrictions).

---

## 17. API 30 vs API 34 Inconsistencies Audit

A rigorous search across all project files revealed the following severe version mismatches:

| Component | File / Location | Value Found | Reality / Impact |
| :--- | :--- | :--- | :--- |
| **GitHub Workflow Action** | `.github/workflows/tiktok-app-booster.yml:71` | `api-level: 30` | Requests **Android 11**, NOT Android 14. |
| **GitHub Workflow Cache** | `.github/workflows/tiktok-app-booster.yml:66` | `key: avd-34-x86_64` | Cache key is labeled API 34 but caches API 30 images. |
| **Local Setup Script** | `scripts/setup_emulator.sh:14` | `android-30;google_apis;x86_64` | Configured for Android 11. |
| **Frontend UI Labels** | `frontend/src/App.jsx:925, 960, 1465` | `Android 14 (API 34)` | **Hardcoded deceptive label**. Displays Android 14 to users while running Android 11. |
| **Runtime Detection** | `src/adb_controller.py` | *Missing* | Never executes `adb shell getprop ro.build.version.sdk` or reports true OS version. |

**Audit Verdict:** The system is currently running **Android 11 (API 30)** while falsely claiming to run Android 14.

---

## 18. Security Audit & Findings

1. **Plaintext Secrets in Code / Commit Risk:** GitHub Personal Access Tokens and Google Service Account JSONs must never be hardcoded into frontend bundles. Token splitting in frontend source was used as a stopgap; authentications should flow strictly through authenticated backend sessions.
2. **Weak Backend JWT Secret Fallback:** `JWT_SECRET` falls back to `'tiktok_live_booster_secret_key_2026'` if the `.env` variable is missing.
3. **Mock Authentication Endpoint:** `POST /api/auth/login` issues valid administrative JWT tokens for any password as long as the email string contains `admin` or `nadeem`. No password hashing or database verification is performed.
4. **Unauthenticated Telemetry Ingestion:** `POST /api/telemetry/heartbeat` does not validate runner API tokens or HMAC signatures, allowing arbitrary telemetry injection if the endpoint is discovered.

---

## 19. Reliability Audit & Findings

1. **Ephemeral State Loss:** All runner telemetry, screen frames, and control queues exist in Node.js RAM. Any PM2 reload drops all live sessions.
2. **Stale Runner Ghosting:** If a GitHub Actions runner crashes or is cancelled by GitHub, it remains marked as active in UI for up to 25 seconds until the polling threshold expires.
3. **Lack of Structured State Machine:** The runner agent reports loose, ad-hoc string messages (`"Connecting to Stream / Dismissing Popups"`, `"Watching & Liking Stream"`) rather than deterministic lifecycle states.
4. **Unbounded Retries:** Auto-reconnect logic lacks exponential backoff and maximum retry thresholds.

---

## 20. Recommended Architecture

```
                                +-------------------------------------------+
                                |             WEB DASHBOARD                 |
                                |  React 18 + WebRTC Video Canvas + Canvas  |
                                |  Touch & Low-Latency Data Channel (WS)    |
                                +---------------------+---------------------+
                                                      |
                                          (WSS / WebRTC Signaling)
                                                      |
+-----------------------------------------------------v-----------------------------------------------------+
|                                            CENTRAL BACKEND                                                |
|  Node.js / Express + WebSocket Server (ws) + WebRTC Signaling + PostgreSQL (Prisma / pg Pool)             |
|  - Authoritative SQL State (runners, sessions, devices, telemetry, commands, accounts)                    |
|  - Real-Time Command & Stream Router                                                                      |
+--------------------------+------------------------------------------------------+-------------------------+
                           |                                                      |
           (Google Sheets Sync Service)                           (GitHub Actions REST Dispatch)
                           |                                                      |
+--------------------------v--------------------------+    +----------------------v-------------------------+
|                  GOOGLE SHEETS                      |    |               GITHUB ACTIONS RUNNER            |
|  Human-managed inventory (Accounts, Proxies)        |    |  Ubuntu 24.04 + KVM Hardware Acceleration      |
+-----------------------------------------------------+    +----------------------+-------------------------+
                                                                                  |
                                                           +----------------------v-------------------------+
                                                           |           ANDROID 14+ CLOUD RUNNER             |
                                                           |  - AVD: API 34 (Android 14) x86_64             |
                                                           |  - Target: google_apis / aosp_atd              |
                                                           |  - Python FGOS Worker Agent                    |
                                                           |  - WebRTC / Low-Latency Screen Server          |
                                                           |  - Low-Level ADB Driver                        |
                                                           |  - TikTok Native Android App                   |
                                                           +------------------------------------------------+
```

### Key Enhancements:
1. **True Android 14+ Execution:** Update workflow to `api-level: 34`, `target: google_apis` or `aosp_atd`, verify with `getprop ro.build.version.sdk == 34`.
2. **WebRTC / Low-Latency Screen Stream:** Integrate an open-source headless stream server (`scrcpy-server` + WebRTC / H.264 video stream) providing <200ms interactive 30 FPS video with bidirectional touch data channel.
3. **Comprehensive SQL Schema:** Implement full PostgreSQL relational schema as the single source of truth.
4. **Deterministic Runner State Machine:** `ADB_CONNECTED`, `ANDROID_BOOTED`, `APP_STARTED`, `AUTH_REQUIRED`, `AUTHENTICATED`, `TARGET_OPENING`, `TARGET_VERIFIED`, `RUNNING`, `RECOVERING`, `STOPPED`, `ERROR`.
5. **Google Sheets Sync Boundary:** Google Sheets as external inventory -> One-way sync to SQL `accounts` table -> Runners interact exclusively with SQL.

---

## 21. Migration Plan

* **Phase 1: Foundation & Audit (Current)**
  - Establish `FGOS_ARCHITECTURE_AUDIT.md` and `FGOS_DATA_FLOW.md`.
  - Design complete SQL schema and state machine definitions.
* **Phase 2: Android 14+ AVD Standardization (P0)**
  - Upgrade `.github/workflows/tiktok-app-booster.yml` and `scripts/setup_emulator.sh` to API 34 (`system-images;android-34;google_apis;x86_64` or `aosp_atd`).
  - Add boot-time verification reporting real SDK level to backend.
* **Phase 3: SQL Database Persistence Layer (P0)**
  - Execute PostgreSQL migration creating all core relational tables.
  - Refactor `backend/server.js` to persist and query all state through SQL.
* **Phase 4: Real-Time Screen & Control Transport (P1)**
  - Implement WebRTC / WebSocket streaming server on runner.
  - Replace frontend screenshot polling with HTML5 Video / Canvas WebRTC stream.
* **Phase 5: State Machine & Google Sheets Sync Service (P1)**
  - Upgrade Python runner agent with formal 11-stage state machine.
  - Implement background Sheets-to-SQL synchronization worker.
* **Phase 6: Multi-Runner Scaling & Production Hardening (P2/P3)**
  - Validate multi-runner scaling across clusters.
  - Polish UI diagnostics and observability metrics.

---

## 22. Files That Need Modification

| File Path | Description of Required Modifications |
| :--- | :--- |
| [`.github/workflows/tiktok-app-booster.yml`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/.github/workflows/tiktok-app-booster.yml) | Upgrade to API 34 (`api-level: 34`, `target: google_apis`/`aosp_atd`), update cache keys, add SDK verification step. |
| [`scripts/setup_emulator.sh`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/scripts/setup_emulator.sh) | Upgrade system image to Android 34. |
| [`backend/server.js`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/backend/server.js) | Implement full PostgreSQL tables, WebRTC/WebSocket signaling, secure authentication, heartbeat state machine tracking. |
| [`backend/package.json`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/backend/package.json) | Add `ws`, `bcryptjs`, and WebRTC signaling dependencies. |
| [`src/config.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/config.py) | Add runtime SDK validation configs and backend session tokens. |
| [`src/adb_controller.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/adb_controller.py) | Add dynamic display resolution mapping, runtime SDK property inspection, dynamic element health checks. |
| [`src/main.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/main.py) | Implement formal state machine lifecycle, runner registration, graceful disconnect, real-time streaming integration. |
| [`src/models.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/models.py) | Expand data models to reflect SQL schema and state machine enums. |
| [`src/sheet_service.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/sheet_service.py) | Decouple runner execution from direct Sheets calls; shift to SQL sync architecture. |
| [`src/auto_login.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/auto_login.py) | Implement state-driven authentication with UI logging and challenge detection. |
| [`frontend/src/App.jsx`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/frontend/src/App.jsx) | Replace screenshot polling with WebRTC video stream, display verified runtime Android version and accurate runner states. |

---

## 23. Files That Can Remain Unchanged

| File Path | Rationale |
| :--- | :--- |
| [`scripts/fast_tap.sh`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/scripts/fast_tap.sh) | High-performance low-level ADB shell script is fully functional and optimized for rapid tapping. |
| [`src/vpn_service.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/vpn_service.py) | NordVPN and PIA WireGuard connection logic operates independently and reliably. |
| [`src/drive_service.py`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/src/drive_service.py) | Google Drive session upload and download routines are solid and tested. |
| [`frontend/vite.config.js`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/frontend/vite.config.js) | Standard Vite build configuration is optimal. |
| [`firebase.json`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/firebase.json) & [`.firebaserc`](file:///c:/Users/Administrator/Desktop/tiktok-live-booster/.firebaserc) | Firebase CDN deployment configuration is correct and working. |
