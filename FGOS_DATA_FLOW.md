# FGOS / TikTok Live Booster: Data Flow & Communication Specifications

**Document Version:** 2.0.0  
**Date:** August 27, 2026  
**Reference Document:** `FGOS_ARCHITECTURE_AUDIT.md`

---

## Flow 1: Primary Execution & Control Flow

This diagram illustrates the complete end-to-end lifecycle of a boost dispatch, runner registration, state tracking, heartbeat monitoring, and clean termination.

```
[ Operator in Browser ]
       |
       | 1. POST /api/runners/dispatch (or Direct GitHub API Dispatch)
       v
+-------------------------------------------------------------+
|                     CENTRAL BACKEND                         |
|  - Validates JWT & Operator Role                            |
|  - Creates task_runs and runner_sessions in SQL (status: PENDING)
|  - Dispatches GitHub Actions Workflow via GitHub API        |
+------------------------------+------------------------------+
                               |
                               | 2. GitHub REST API (workflow_dispatch)
                               v
+-------------------------------------------------------------+
|                  GITHUB ACTIONS RUNNER                      |
|  - Boots Headless Ubuntu 24.04 VM                           |
|  - Sets up /dev/kvm permissions                             |
|  - Creates & Launches Android 14 AVD (API 34)               |
|  - Boots Android OS (sys.boot_completed == 1)               |
|  - Verifies ADB connection (adb get-state == device)        |
+------------------------------+------------------------------+
                               |
                               | 3. Launches Python FGOS Runner Agent
                               v
+-------------------------------------------------------------+
|                    FGOS RUNNER AGENT                        |
|  - Inspects real Android SDK: ro.build.version.sdk == 34    |
|  - Inspects display metrics: wm size (e.g., 1080x2400)      |
+------------------------------+------------------------------+
                               |
                               | 4. POST /api/runners/register
                               v
+-------------------------------------------------------------+
|                     CENTRAL BACKEND                         |
|  - Inserts/Updates runners & runner_sessions in SQL         |
|  - Status: REGISTERED (android_version='14', sdk=34)        |
+------------------------------+------------------------------+
                               |
                               | 5. Runner starts heartbeat loop (every 2.5s)
                               v
+-------------------------------------------------------------+
|         HEARTBEAT & STATE MACHINE SYNCHRONIZATION           |
|                                                             |
|  Runner Agent                  Backend (SQL Database)       |
|       |                                  |                  |
|       |-- POST /api/runners/heartbeat -->| (Updates last_hb)|
|       |   state: ANDROID_BOOTED          |                  |
|       |   state: APP_STARTED             |                  |
|       |   state: TARGET_OPENING          |                  |
|       |   state: TARGET_VERIFIED         |                  |
|       |   state: RUNNING (likes=120)     |                  |
|       |                                  |                  |
|       |<-- HTTP 200 OK (pending cmds) ---|                  |
+-------------------------------------------------------------+
                               |
                               | 6. Graceful Session Completion / Termination
                               v
+-------------------------------------------------------------+
|                     CLEAN SHUTDOWN                          |
|  - Runner sends POST /api/runners/stop (state: COMPLETED)   |
|  - Backend marks runner_sessions as 'STOPPED' in SQL        |
|  - Disconnect watchdog detects any unannounced runner crash |
|    and marks status as 'OFFLINE' / 'DISCONNECTED'           |
+-------------------------------------------------------------+
```

---

## Flow 2: Google Sheets Operational Data Synchronization Flow

This diagram defines the clean operational boundary where human-editable accounts in Google Sheets are safely synchronized into the authoritative SQL database, decoupling runners from direct Sheets dependencies.

```
+-------------------------------------------------------------+
|                       GOOGLE SHEETS                         |
|  - Managed manually by team / operators                     |
|  - Contains: username, password, proxy, target stream       |
+------------------------------+------------------------------+
                               |
                               | Read-only batch query (every 60s or on-demand)
                               v
+-------------------------------------------------------------+
|                 BACKGROUND SYNC WORKER                      |
|  - Validates row format & credentials                       |
|  - Computes persistent Android Hardware IDs                 |
|  - Detects changes, new accounts, and status updates        |
+------------------------------+------------------------------+
                               |
                               | Atomic UPSERT into PostgreSQL
                               v
+-------------------------------------------------------------+
|                 POSTGRESQL DATABASE (SQL)                   |
|                                                             |
|  Table: accounts                                            |
|  ---------------------------------------------------------  |
|  id | username | device_id | proxy | status | assigned_to   |
|  ---+----------+-----------+-------+--------+-------------  |
|  1  | user1@.. | 4a8f9b2c. | http. | READY  | runner-0      |
+------------------------------+------------------------------+
                               ^
                               |
             Query assigned account via SQL API
                               |
+------------------------------+------------------------------+
|                     FGOS RUNNER AGENT                       |
|  - Operates completely independent of Google Sheets uptime  |
|  - Zero Google API rate limits during high-concurrency runs |
+-------------------------------------------------------------+
```

---

## Flow 3: Real-Time Remote Screen & Interactive Control Flow

This diagram details the low-latency WebRTC / WebSocket video streaming and bidirectional touch control pipeline between the headless Android emulator and the operator's browser.

```
+-------------------------------------------------------------+
|                   ANDROID EMULATOR (AVD)                    |
|  - Android 14 (API 34) Headless                             |
|  - Hardware Framebuffer / SurfaceFlinger                    |
+------------------------------+------------------------------+
                               |
                               | Low-level screen capture (scrcpy-server / raw H.264)
                               v
+-------------------------------------------------------------+
|                 RUNNER STREAMING SERVER                     |
|  - Reads H.264 video NAL units from Android framebuffer     |
|  - Packages into WebRTC MediaStreamTrack or low-latency WS  |
|  - Listens for remote touch input on DataChannel            |
+------------------------------+------------------------------+
                               |
                               | WebRTC MediaStream (H.264 / 30 FPS / <150ms Latency)
                               | & WebRTC DataChannel (Touch / Keys / Swipes)
                               v
+-------------------------------------------------------------+
|                     CENTRAL BACKEND                         |
|  - WebSockets & WebRTC Signaling Broker (SDP / ICE)         |
|  - Authenticates operator session against SQL database      |
+------------------------------+------------------------------+
                               |
                               | Direct P2P / Tunneled WebRTC Media Stream
                               v
+-------------------------------------------------------------+
|                  OPERATOR WEB DASHBOARD                     |
|  - HTML5 <video> / WebGL Canvas Viewport                    |
|  - Live 30 FPS smooth video streaming                       |
|  - PointerEvent listener mapping browser clicks to exact    |
|    Android physical resolution (e.g. 1080x2400)             |
|  - Low-latency touch transmission (<50ms input lag)         |
+-------------------------------------------------------------+
```
