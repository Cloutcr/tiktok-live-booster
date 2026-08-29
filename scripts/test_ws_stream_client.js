const WebSocket = require('../backend/node_modules/ws');
const https = require('https');

async function testStream() {
  console.log('=== [Stream Monitor] Authenticating with Central Backend ===');
  
  // 1. Get JWT Token
  const token = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'admin@booster.local', password: 'admin' });
    const req = https.request('https://api.fgos.site/tiktok/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve(j.token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  console.log('  [+] Authenticated. Token acquired.');

  // 2. Connect Browser WebSocket Client
  const wsUrl = `wss://api.fgos.site/tiktok/ws/stream?role=browser&runner_key=tiktok-live-booster_runner_0&token=${token}`;
  console.log(`=== [Stream Monitor] Connecting to WebSocket: ${wsUrl} ===`);

  const ws = new WebSocket(wsUrl);
  let binaryChunks = 0;
  let totalBytes = 0;
  let hasNal = false;

  ws.on('open', () => {
    console.log('  [+] WebSocket Stream Connection OPENED successfully!');
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary || Buffer.isBuffer(data)) {
      binaryChunks++;
      totalBytes += data.length;
      if (!hasNal && (data.includes(Buffer.from([0, 0, 0, 1])) || data.includes(Buffer.from([0, 0, 1])))) {
        hasNal = true;
        console.log(`  [PASS] Detected H.264 NAL header in chunk #${binaryChunks}! Length: ${data.length} bytes`);
      }
      if (binaryChunks % 30 === 0) {
        console.log(`  [Stream Active] Received ${binaryChunks} chunks, Total: ${(totalBytes / 1024).toFixed(1)} KB`);
      }
    } else {
      console.log('  [Text Message]:', data.toString());
    }
  });

  ws.on('error', (err) => {
    console.log('  [WebSocket Error]:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`  [WebSocket Closed]: Code ${code} Reason: ${reason}`);
  });

  // Keep open for 180 seconds while emulator boots and streams
  setTimeout(() => {
    console.log(`=== Stream Test Summary: Chunks=${binaryChunks}, Bytes=${totalBytes}, H264_NAL=${hasNal} ===`);
    ws.close();
    process.exit(0);
  }, 180000);
}

testStream().catch(console.error);
