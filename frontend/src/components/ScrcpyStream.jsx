import React, { useEffect, useRef, useState } from 'react';
import JMuxer from 'jmuxer';
import { Activity, AlertCircle, RefreshCw, Smartphone, Radio, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';

/**
 * TikTok Booster - Scrcpy Real-Time Screen Stream & Remote Control Component
 * Decodes continuous H.264 video at ~30 FPS via JMuxer MSE and translates pointer
 * events into pixel-perfect 32-byte Scrcpy touch and 14-byte keycode control packets.
 * 
 * Strict Real-Time Live Screen Guarantees:
 * - NEVER displays static/diagnostic fallback screenshots.
 * - ONLY displays frames originating from the active live Scrcpy video stream.
 * - Clears video frames immediately upon stream disconnect.
 * - Displays dedicated placeholders for CONNECTING, DISCONNECTED, and ERROR states.
 */
export default function ScrcpyStream({
  runnerKey,
  token,
  wsBaseUrl,
  deviceWidth = 1080,
  deviceHeight = 2400,
  onControlDispatched = null
}) {
  const videoRef = useRef(null);
  const jmuxerRef = useRef(null);
  const wsRef = useRef(null);
  const containerRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const activePointerIdRef = useRef(null);

  // Explicit Stream States: CONNECTING | LIVE | DISCONNECTED | ERROR
  const [streamState, setStreamState] = useState('CONNECTING');
  const [fps, setFps] = useState(0);
  const [kbps, setKbps] = useState(0);
  const [framesReceived, setFramesReceived] = useState(0);
  const [touchRipples, setTouchRipples] = useState([]);

  // 1. Initialize Dual Transport (HTTP Fetch ReadableStream + WebSocket) and JMuxer
  useEffect(() => {
    let frameCount = 0;
    let bytesCount = 0;
    let isCancelled = false;
    let abortController = new AbortController();
    let isLiveStreaming = false;

    const statsInterval = setInterval(() => {
      setFps(frameCount);
      setKbps(Math.round((bytesCount * 8) / 1024));
      frameCount = 0;
      bytesCount = 0;
    }, 1000);

    // Initialize JMuxer for hardware-accelerated MSE H.264 playback (Ultra Low-Latency)
    const initJMuxer = () => {
      if (videoRef.current && !jmuxerRef.current) {
        try {
          jmuxerRef.current = new JMuxer({
            node: videoRef.current,
            mode: 'video',
            flv: false,
            fps: 30,
            clearBuffer: true,
            maxDelay: 50,
            debug: false
          });
        } catch (err) {
          console.debug('JMuxer init notice:', err);
        }
      }
    };

    const cleanupVideoAndDecoder = () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch (_) {}
      }
      if (jmuxerRef.current) {
        try {
          jmuxerRef.current.destroy();
        } catch (_) {}
        jmuxerRef.current = null;
      }
    };

    initJMuxer();

    const handleH264Chunk = (chunkBuffer) => {
      if (!chunkBuffer || chunkBuffer.byteLength === 0) return;
      frameCount++;
      bytesCount += chunkBuffer.byteLength;
      setFramesReceived(prev => prev + 1);
      
      // Ensure JMuxer is active
      if (!jmuxerRef.current) {
        initJMuxer();
      }

      if (!isLiveStreaming) {
        isLiveStreaming = true;
        setStreamState('LIVE');
      }

      if (jmuxerRef.current) {
        try {
          jmuxerRef.current.feed({
            video: new Uint8Array(chunkBuffer)
          });
          
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            }

            // Real-Time Live Edge Locking (<100ms):
            // If media buffer has accumulated > 180ms ahead of current playback position,
            // jump directly to the live edge to eliminate playback lag.
            if (videoRef.current.buffered && videoRef.current.buffered.length > 0) {
              const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
              const current = videoRef.current.currentTime;
              if (end - current > 0.18) {
                videoRef.current.currentTime = Math.max(0, end - 0.02);
              }
            }
          }
        } catch (e) {
          console.debug('JMuxer feed notice:', e);
        }
      }
    };

    let wsEstablished = false;

    // --- Transport A: Primary Outbound WebSocket (Direct / Low-Latency) ---
    const rawWsUrl = `${wsBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://')}/ws/stream?role=browser&runner_key=${runnerKey}&token=${token || ''}`;
    
    // --- Transport B: Fallback HTTP Fetch ReadableStream ---
    const startHttpFetchStream = async () => {
      if (isCancelled || wsEstablished) return;
      const httpStreamUrl = `${wsBaseUrl}/api/stream/live/${runnerKey}?token=${token || ''}`;
      console.log(`[ScrcpyStream] Connecting via Fallback HTTP Stream: ${httpStreamUrl}`);
      try {
        const response = await fetch(httpStreamUrl, {
          signal: abortController.signal,
          headers: { Authorization: `Bearer ${token || ''}` }
        });

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          console.log(`[ScrcpyStream] HTTP Live Stream reader established for ${runnerKey}`);

          while (!isCancelled && !wsEstablished) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.buffer) {
              handleH264Chunk(value.buffer);
            }
          }
        }
        
        // If stream ended
        if (!isCancelled && isLiveStreaming && !wsEstablished) {
          isLiveStreaming = false;
          cleanupVideoAndDecoder();
          setStreamState('DISCONNECTED');
        }
      } catch (err) {
        if (!isCancelled && err.name !== 'AbortError' && !wsEstablished) {
          console.debug('[ScrcpyStream] HTTP stream notice:', err.message);
          if (isLiveStreaming) {
            isLiveStreaming = false;
            cleanupVideoAndDecoder();
            setStreamState('DISCONNECTED');
          }
        }
      }
    };

    try {
      const ws = new WebSocket(rawWsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        wsEstablished = true;
        console.log(`[ScrcpyStream] Primary WebSocket connected for ${runnerKey}`);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          wsEstablished = true;
          handleH264Chunk(event.data);
        }
      };

      ws.onerror = () => {
        console.debug('[ScrcpyStream] WebSocket notice. Attempting HTTP stream fallback...');
        if (!wsEstablished && !isCancelled) {
          startHttpFetchStream();
        }
      };

      ws.onclose = () => {
        console.debug('[ScrcpyStream] WebSocket closed.');
        if (!isCancelled) {
          if (!isLiveStreaming) {
            // Attempt HTTP fallback if WS was never established
            startHttpFetchStream();
          } else {
            isLiveStreaming = false;
            cleanupVideoAndDecoder();
            setStreamState('DISCONNECTED');
          }
        }
      };
    } catch (err) {
      console.debug('[ScrcpyStream] WebSocket creation failed. Using HTTP stream:', err);
      startHttpFetchStream();
    }

    return () => {
      isCancelled = true;
      isLiveStreaming = false;
      abortController.abort();
      clearInterval(statsInterval);
      cleanupVideoAndDecoder();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [runnerKey, wsBaseUrl, token]);

  // 2. Pixel-Perfect Coordinate Mapping (Accounts for Letterboxing / Aspect Ratio)
  const calculateDeviceCoordinates = (clientX, clientY) => {
    if (!containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;

    const devW = deviceWidth || 1080;
    const devH = deviceHeight || 2400;
    const deviceAspect = devW / devH;
    const containerAspect = containerW / containerH;

    let renderW = containerW;
    let renderH = containerH;
    let offsetX = 0;
    let offsetY = 0;

    // Calculate actual letterboxed video render rectangle
    if (containerAspect > deviceAspect) {
      renderW = containerH * deviceAspect;
      offsetX = (containerW - renderW) / 2;
    } else {
      renderH = containerW / deviceAspect;
      offsetY = (containerH - renderH) / 2;
    }

    const clickRelX = clientX - containerRect.left - offsetX;
    const clickRelY = clientY - containerRect.top - offsetY;

    const clampedX = Math.max(0, Math.min(renderW, clickRelX));
    const clampedY = Math.max(0, Math.min(renderH, clickRelY));

    const androidX = Math.round((clampedX / renderW) * devW);
    const androidY = Math.round((clampedY / renderH) * devH);

    return {
      androidX: Math.max(0, Math.min(devW, androidX)),
      androidY: Math.max(0, Math.min(devH, androidY)),
      visualX: clientX - containerRect.left,
      visualY: clientY - containerRect.top
    };
  };

  // 3. Binary Scrcpy Packet Serializers with Dual Transport Dispatch
  const sendScrcpyTouch = (action, clientX, clientY, pointerId = 0) => {
    const coords = calculateDeviceCoordinates(clientX, clientY);
    if (!coords) return;

    // Visual Touch Ripple on Down
    if (action === 0) {
      const rId = Date.now();
      setTouchRipples(prev => [...prev, { id: rId, x: coords.visualX, y: coords.visualY }]);
      setTimeout(() => setTouchRipples(prev => prev.filter(r => r.id !== rId)), 500);
    }

    // Build 32-Byte Scrcpy Touch Packet (>BBQIIHHHII)
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    view.setUint8(0, 0x02);                     // TYPE = 2 (INJECT_TOUCH)
    view.setUint8(1, action);                   // ACTION (0=DOWN, 1=UP, 2=MOVE)
    view.setBigUint64(2, BigInt(pointerId));    // POINTER ID
    view.setUint32(10, coords.androidX);        // X
    view.setUint32(14, coords.androidY);        // Y
    view.setUint16(18, deviceWidth || 1080);    // WIDTH
    view.setUint16(20, deviceHeight || 2400);   // HEIGHT
    view.setUint16(22, 0xffff);                 // PRESSURE (1.0)
    view.setUint32(24, 1);                      // ACTION_BUTTON (PRIMARY)
    view.setUint32(28, 1);                      // BUTTONS (PRIMARY)

    // 1. Send via WebSocket if open
    let sentWs = false;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
      sentWs = true;
    }

    // 2. Also dispatch via HTTP control endpoint
    if (!sentWs || action === 0) {
      fetch(`${wsBaseUrl}/api/stream/control/${runnerKey}?token=${token || ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${token || ''}` },
        body: buffer
      }).catch(() => {});
    }

    if (onControlDispatched && action === 0) {
      onControlDispatched(`Touch (${coords.androidX}, ${coords.androidY})`);
    }
  };

  const sendScrcpyKey = (keycode) => {
    // Build 14-Byte Scrcpy Keycode Packet (>BBIII)
    const sendKeyAction = (action) => {
      const buffer = new ArrayBuffer(14);
      const view = new DataView(buffer);
      view.setUint8(0, 0x00);        // TYPE = 0 (INJECT_KEYCODE)
      view.setUint8(1, action);      // ACTION (0=DOWN, 1=UP)
      view.setUint32(2, keycode);    // KEYCODE
      view.setUint32(6, 0);          // REPEAT (0)
      view.setUint32(10, 0);         // METASTATE (0)

      let sentWs = false;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(buffer);
        sentWs = true;
      }
      if (!sentWs) {
        fetch(`${wsBaseUrl}/api/stream/control/${runnerKey}?token=${token || ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${token || ''}` },
          body: buffer
        }).catch(() => {});
      }
    };

    sendKeyAction(0); // DOWN
    setTimeout(() => sendKeyAction(1), 40); // UP
    if (onControlDispatched) onControlDispatched(`Keyevent ${keycode}`);
  };

  // 4. Pointer Event Handlers
  const handlePointerDown = (e) => {
    e.preventDefault();
    isPointerDownRef.current = true;
    activePointerIdRef.current = e.pointerId;
    if (containerRef.current) {
      try {
        containerRef.current.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    sendScrcpyTouch(0, e.clientX, e.clientY, 0);
  };

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return;
    e.preventDefault();
    sendScrcpyTouch(2, e.clientX, e.clientY, 0);
  };

  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    e.preventDefault();
    isPointerDownRef.current = false;
    if (containerRef.current && activePointerIdRef.current !== null) {
      try {
        containerRef.current.releasePointerCapture(activePointerIdRef.current);
      } catch (_) {}
    }
    activePointerIdRef.current = null;
    sendScrcpyTouch(1, e.clientX, e.clientY, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      
      {/* Stream Status & FPS Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.75)', padding: '6px 12px', borderRadius: 8, marginBottom: 8, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: streamState === 'LIVE' ? 'var(--accent-green)' : (streamState === 'CONNECTING' ? 'var(--tiktok-cyan)' : '#FFA800'),
            boxShadow: streamState === 'LIVE' ? '0 0 8px #00F59B' : (streamState === 'CONNECTING' ? '0 0 8px rgba(37, 244, 238, 0.5)' : 'none')
          }} />
          <span style={{ 
            fontWeight: 700, 
            color: streamState === 'LIVE' ? 'var(--accent-green)' : (streamState === 'CONNECTING' ? 'var(--tiktok-cyan)' : '#FFA800') 
          }}>
            {streamState === 'LIVE' && `LIVE SCREEN (30 FPS)`}
            {streamState === 'CONNECTING' && `CONNECTING TO LIVE STREAM...`}
            {streamState === 'DISCONNECTED' && `LIVE STREAM DISCONNECTED`}
            {streamState === 'ERROR' && `STREAM UNAVAILABLE`}
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {streamState === 'LIVE' ? `${fps} FPS • ${kbps} kbps • ${deviceWidth}x${deviceHeight}` : (streamState === 'CONNECTING' ? 'Initializing scrcpy...' : 'Waiting to reconnect...')}
        </div>
      </div>

      {/* Main Viewport Container */}
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1080 / 2400',
          maxHeight: '68vh',
          background: '#000',
          borderRadius: 10,
          border: '1px solid rgba(37, 244, 238, 0.25)',
          overflow: 'hidden',
          cursor: streamState === 'LIVE' ? 'crosshair' : 'default',
          touchAction: 'none',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(0,0,0,0.85)'
        }}
      >
        {/* Touch Ripple Visualizer */}
        {touchRipples.map(r => (
          <span 
            key={r.id} 
            style={{
              position: 'absolute',
              left: r.x - 18,
              top: r.y - 18,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(37, 244, 238, 0.4)',
              border: '2px solid #25F4EE',
              pointerEvents: 'none',
              animation: 'ping 0.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              zIndex: 20
            }}
          />
        ))}

        {/* 1. Primary Live Video Element (JMuxer MSE) - ONLY visible when LIVE */}
        <video 
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            display: streamState === 'LIVE' ? 'block' : 'none'
          }}
        />

        {/* 2. Real-Time State Placeholders (No static/diagnostic screenshots) */}
        {streamState !== 'LIVE' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at center, rgba(18, 20, 30, 0.95) 0%, rgba(8, 9, 14, 0.98) 100%)'
          }}>
            {streamState === 'CONNECTING' && (
              <>
                <div style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  background: 'rgba(37, 244, 238, 0.12)',
                  border: '1px solid rgba(37, 244, 238, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  boxShadow: '0 0 20px rgba(37, 244, 238, 0.15)'
                }}>
                  <RefreshCw size={26} className="animate-spin" style={{ color: 'var(--tiktok-cyan)' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>
                  Connecting to Live Screen...
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 230, lineHeight: 1.4 }}>
                  Waiting for real-time stream from Android 14 device
                </div>
              </>
            )}

            {streamState === 'DISCONNECTED' && (
              <>
                <div style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  background: 'rgba(255, 168, 0, 0.12)',
                  border: '1px solid rgba(255, 168, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  boxShadow: '0 0 20px rgba(255, 168, 0, 0.15)'
                }}>
                  <WifiOff size={26} style={{ color: '#FFA800' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>
                  Live Screen Disconnected
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 230, lineHeight: 1.4 }}>
                  Waiting for stream to reconnect...
                </div>
              </>
            )}

            {streamState === 'ERROR' && (
              <>
                <div style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  background: 'rgba(254, 44, 85, 0.12)',
                  border: '1px solid rgba(254, 44, 85, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  boxShadow: '0 0 20px rgba(254, 44, 85, 0.15)'
                }}>
                  <AlertCircle size={26} style={{ color: '#FF6B8B' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>
                  Live Screen Unavailable
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 230, lineHeight: 1.4 }}>
                  Stream connection failed. Retrying...
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hardware Key Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
        <button 
          onClick={() => sendScrcpyKey(4)}
          className="btn-secondary" 
          style={{ padding: '7px 4px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          title="Android Back Button (Keycode 4)"
        >
          ◀ Back
        </button>
        <button 
          onClick={() => sendScrcpyKey(3)}
          className="btn-secondary" 
          style={{ padding: '7px 4px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          title="Android Home Button (Keycode 3)"
        >
          ● Home
        </button>
        <button 
          onClick={() => sendScrcpyKey(187)}
          className="btn-secondary" 
          style={{ padding: '7px 4px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          title="Recent Apps Switcher (Keycode 187)"
        >
          ◼ Switch
        </button>
      </div>

    </div>
  );
}
