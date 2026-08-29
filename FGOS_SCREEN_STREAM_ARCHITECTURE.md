# FGOS / TikTok Live Booster: Real-Time Screen Streaming & Remote Control Architecture

**Document Version:** 2.0.0  
**Date:** August 27, 2026  
**Status:** Milestone 1 Architecture Specification  

---

## 1. Executive Summary & Objective

The objective is to replace the legacy HTTP screenshot slideshow (0.33 FPS, 2500ms–5000ms latency) with an **open-source, low-latency, real-time Android screen streaming and interactive control engine** (<150ms glass-to-glass latency, 30 FPS smooth video) running headlessly on Ubuntu GitHub Actions runners.

---

## 2. Technology Evaluation & Selection

| Criteria | Legacy (Screencap + HTTP POST) | scrcpy-server + WebSocket Bridge | WebRTC P2P |
| :--- | :--- | :--- | :--- |
| **FPS** | ~0.33 FPS (1 frame / 3s) | **30–60 FPS** | 30–60 FPS |
| **Glass-to-Glass Latency** | 2,500ms – 5,000ms | **< 120ms** | < 100ms |
| **Bandwidth** | 15 KB / frame (slideshow) | **~350 Kbps** (H.264 delta) | ~400 Kbps |
| **Interactive Touch Lag** | 2,500ms – 5,000ms | **< 30ms** | < 30ms |
| **Headless Linux Support** | Yes | **Yes (Direct SurfaceFlinger/MediaCodec)** | Complex NAT/ICE traversal |
| **Android 14 (API 34) Support**| Yes | **Yes (scrcpy v2.4+ API 34 verified)** | Yes |
| **License** | Custom | **Apache 2.0 (Open Source)** | Open Source |

### Selected Stack:
* **Android Agent:** `scrcpy-server.jar` deployed directly to `/data/local/tmp/scrcpy-server.jar` on the Android 14 AVD.
* **Runner Bridge:** Python / Node.js forwarder listening on TCP port 27183.
* **Transport:** WebSocket / WebRTC binary stream to Central Gateway / Browser.
* **Browser Renderer:** HTML5 `<canvas>` using the native **WebCodecs API** (`VideoDecoder` / `createImageBitmap`) and **jmuxer** fallback for hardware-accelerated, zero-lag playback.
* **Input Channel:** Binary touch/key packets sent over the same WebSocket / DataChannel connection directly to `scrcpy-server`'s control socket.

---

## 3. End-to-End Pipeline Architecture

```
[ Android 14 Emulator (AVD) ]
       |
       | 1. Hardware Screen Capture via MediaCodec (1080x2400 @ 30 FPS)
       v
+-------------------------------------------------------------+
|                     scrcpy-server.jar                       |
|  - Runs inside Android OS via app_process                   |
|  - Encodes H.264 Annex B NAL units (SPS, PPS, IDR, P-frames)|
|  - Receives binary touch events (DOWN, MOVE, UP)            |
+------------------------------+------------------------------+
                               |
                               | Local Socket / Forwarded Port (27183)
                               v
+-------------------------------------------------------------+
|                 RUNNER STREAMING FORWARDER                  |
|  - Reads binary H.264 stream from scrcpy socket             |
|  - Multiplexes video frames and control messages            |
|  - Connects to Central Backend WebSocket relay              |
+------------------------------+------------------------------+
                               |
                               | Secure WebSocket Binary Stream (WSS)
                               v
+-------------------------------------------------------------+
|                   CENTRAL BACKEND (VM)                      |
|  - Multiplexes runner video streams to authorized browsers  |
|  - Authenticates WebSocket sessions against PostgreSQL      |
|  - Relays browser touch input back to runner forwarder      |
+------------------------------+------------------------------+
                               |
                               | Low-Latency WSS Stream (<100ms)
                               v
+-------------------------------------------------------------+
|                   OPERATOR WEB DASHBOARD                    |
|  - React 18 Canvas Stream Component                         |
|  - WebCodecs VideoDecoder / jmuxer (30 FPS continuous video)|
|  - PointerEvent Listener (translates viewport clicks        |
|    directly to Android physical resolution)                 |
+-------------------------------------------------------------+
```

---

## 4. Input & Coordinate Transformation Protocol

To ensure 100% accurate touch registration:

1. **Physical Display Resolution:**
   The runner inspects the device resolution via `wm size` (e.g. `1080x2400`) and reports `display_width` and `display_height` upon registration in SQL.
2. **Browser Coordinate Translation:**
   ```javascript
   function handlePointerEvent(e, canvas, deviceWidth, deviceHeight) {
     const rect = canvas.getBoundingClientRect();
     const clientX = e.clientX - rect.left;
     const clientY = e.clientY - rect.top;

     // Calculate exact integer Android pixel coordinates
     const androidX = Math.max(0, Math.min(deviceWidth, Math.round((clientX / rect.width) * deviceWidth)));
     const androidY = Math.max(0, Math.min(deviceHeight, Math.round((clientY / rect.height) * deviceHeight)));

     return {
       type: e.type, // pointerdown, pointermove, pointerup
       x: androidX,
       y: androidY,
       timestamp: Date.now()
     };
   }
   ```
3. **Binary Control Packet Structure:**
   Sent directly to the runner for sub-30ms execution on Android:
   - `0x00`: Inject Touch (Action: Down/Move/Up, X, Y, Pressure).
   - `0x01`: Inject Keycode (Back: 4, Home: 3, App Switcher: 187).
   - `0x02`: Inject Text (UTF-8 string).
   - `0x03`: Inject Swipe (x1, y1, x2, y2, duration_ms).

---

## 5. Diagnostic / Legacy Fallback Strategy

* The existing HTTP base64 screenshot mechanism (`adb exec-out screencap -p`) is retained as a diagnostic fallback.
* If WebCodecs or WebSocket stream encounters a network drop, the dashboard gracefully displays the latest diagnostic snapshot while the stream automatically reconnects.
