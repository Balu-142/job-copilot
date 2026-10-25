const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
let qrcodeTerminal = null;
try {
  qrcodeTerminal = require('qrcode-terminal');
} catch (_) {}

const PORT = process.env.PORT || 3500;
const rootDir = path.resolve(__dirname, '..');

function getLocalIp() {
  try {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(interfaces)) {
      const lower = name.toLowerCase();
      if (
        lower.includes('virtualbox') ||
        lower.includes('vmware') ||
        lower.includes('wsl') ||
        lower.includes('vethernet') ||
        lower.includes('loopback')
      ) {
        continue;
      }
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.')) {
          // Skip VirtualBox host-only & Windows APIPA self-assigned addresses
          if (iface.address.startsWith('192.168.56.') || iface.address.startsWith('169.254.')) {
            continue;
          }
          if (lower.includes('wi-fi') || lower.includes('wireless') || lower.includes('wlan')) {
            return iface.address;
          }
          candidates.push(iface.address);
        }
      }
    }
    if (candidates.length > 0) return candidates[0];
  } catch (err) {
    // fallback
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();

console.log('============================================================');
console.log(' 🚀 Starting JobCopilot Pro High-Reliability Global Host...');
console.log('============================================================');

let tunnelProcess = null;
let serverProcess = null;
let currentTunnelUrl = null;
let isShuttingDown = false;

function generateMobileAccessHtml(globalUrl, wifiUrl) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(globalUrl)}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JobCopilot Pro - Mobile Device Connect</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: rgba(255, 255, 255, 0.1);
      --primary: #3b82f6;
      --green: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 6px 14px;
      border-radius: 30px;
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 10px var(--green);
    }
    h1 {
      font-size: 1.6rem;
      font-weight: 800;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #fff, #93c5fd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.sub {
      color: #94a3b8;
      font-size: 0.92rem;
      margin-bottom: 24px;
    }
    .qr-frame {
      background: #ffffff;
      padding: 16px;
      border-radius: 16px;
      display: inline-block;
      margin-bottom: 24px;
      box-shadow: 0 8px 30px rgba(59, 130, 246, 0.25);
    }
    .qr-frame img {
      display: block;
      width: 240px;
      height: 240px;
      border-radius: 8px;
    }
    .link-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      text-align: left;
    }
    .link-title {
      font-size: 0.72rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .link-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #38bdf8;
      word-break: break-all;
    }
    .btn-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    .btn {
      flex: 1;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #2563eb;
      color: #fff;
      border: none;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-outline {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    .btn-outline:hover { background: rgba(255, 255, 255, 0.05); }
    .tips {
      text-align: left;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 0.8rem;
      color: #94a3b8;
      line-height: 1.5;
    }
    .tips strong { color: #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> GLOBAL LIVE SERVICE ACTIVE</div>
    <h1>Open on Phone / Other Device</h1>
    <p class="sub">Point your phone's camera at the QR code below to open JobCopilot instantly without typing any URL.</p>

    <div class="qr-frame">
      <img src="${qrUrl}" alt="JobCopilot Mobile Access QR Code">
    </div>

    <div class="link-box">
      <div class="link-title">🌐 Worldwide Public HTTPS URL:</div>
      <div class="link-val">${globalUrl}</div>
    </div>

    <div class="btn-row">
      <a href="${globalUrl}" target="_blank" class="btn btn-primary">Open Directly</a>
      <button onclick="navigator.clipboard.writeText('${globalUrl}'); alert('URL copied to clipboard! Paste it on WhatsApp, Slack, or any browser.');" class="btn btn-outline">Copy Link</button>
    </div>

    <div class="tips">
      <strong>📱 How to open on other devices:</strong><br>
      • <strong>Any Phone/Tablet (4G/5G/Wi-Fi):</strong> Open your Camera app and scan the QR code above.<br>
      • <strong>Local Wi-Fi Address:</strong> <code style="color:#34d399">${wifiUrl}</code><br>
      • <strong>Status:</strong> Powered by Cloudflare HTTP/2 Secure Edge.
    </div>
  </div>
</body>
</html>`;

  try {
    fs.writeFileSync(path.join(rootDir, 'MOBILE_ACCESS.html'), html, 'utf8');
  } catch (_) {}
}

function startBackendServer() {
  serverProcess = spawn('node', ['backend/server.js'], {
    cwd: rootDir,
    shell: true,
    env: { ...process.env, PORT: String(PORT), HOST: '0.0.0.0' },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    const line = data.toString();
    if (line.includes('Scanned') || line.includes('Job Hunter') || line.includes('LIVE')) {
      process.stdout.write(`[Server] ${line}`);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(`[Server Error] ${data.toString()}`);
  });

  serverProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      console.log(`[Server] Exited with code ${code}. Restarting server in 2s...`);
      setTimeout(startBackendServer, 2000);
    }
  });
}

function startCloudflareTunnel() {
  if (isShuttingDown) return;
  console.log('\n[Tunnel] Establishing Cloudflare HTTP/2 Global Tunnel (Port 443 TCP)...');

  const localBinary = path.join(rootDir, 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  const hasLocalBinary = fs.existsSync(localBinary);

  const binCmd = hasLocalBinary ? localBinary : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
  const binArgs = hasLocalBinary
    ? ['tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${PORT}`]
    : ['--yes', 'cloudflared', 'tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${PORT}`];

  // Using --protocol http2 to avoid UDP QUIC packet drops on mobile/broadband networks
  tunnelProcess = spawn(binCmd, binArgs, {
    cwd: rootDir,
    shell: !hasLocalBinary,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let urlDetected = false;

  function handleTunnelData(chunk) {
    const text = chunk.toString();

    // Check if Cloudflare rejected or expired the quick tunnel session
    if (text.includes('Unauthorized: Tunnel not found')) {
      console.warn('\n⚠️ [Tunnel] Cloudflare quick tunnel expired. Refreshing tunnel connection in 2s...');
      urlDetected = false;
      try {
        tunnelProcess.kill();
      } catch (_) {}
      return;
    }

    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !urlDetected) {
      urlDetected = true;
      currentTunnelUrl = match[0];
      const wifiUrl = `http://${localIp}:${PORT}`;

      try {
        fs.writeFileSync(path.join(rootDir, 'public_url.txt'), currentTunnelUrl, 'utf8');
      } catch (_) {}

      generateMobileAccessHtml(currentTunnelUrl, wifiUrl);

      console.log('\n================================================================================');
      console.log(' 🎉 JOB COPILOT IS NOW LIVE WORLDWIDE ACROSS ALL DEVICES!');
      console.log('================================================================================');
      console.log(' 🌐 GLOBAL PUBLIC URL (Open on ANY phone, tablet, or PC worldwide):');
      console.log(`    👉 \x1b[36m\x1b[1m${currentTunnelUrl}\x1b[0m`);
      console.log('    (Works on 4G/5G mobile data, remote networks, recruiters, tablets, any browser)');
      console.log('');
      console.log(' 📱 LOCAL WI-FI URL (Devices connected to your same Wi-Fi):');
      console.log(`    👉 \x1b[32m${wifiUrl}\x1b[0m`);
      console.log('');
      console.log(' 📄 RESUME DOWNLOAD URL:');
      console.log(`    👉 ${currentTunnelUrl}/api/resume/download`);
      console.log('================================================================================');

      if (qrcodeTerminal) {
        console.log('\n 📲 SCAN WITH PHONE CAMERA TO OPEN INSTANTLY:');
        qrcodeTerminal.generate(currentTunnelUrl, { small: true }, (qr) => {
          console.log(qr);
        });
      }

      console.log(' 💡 A helper page has also been created:');
      console.log(`    👉 Open: ${path.join(rootDir, 'MOBILE_ACCESS.html')}`);
      console.log('================================================================================');
      console.log(' ℹ️  Keep this service running to maintain your live connection.\n');
    }
  }

  tunnelProcess.stdout.on('data', handleTunnelData);
  tunnelProcess.stderr.on('data', handleTunnelData);

  tunnelProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      console.warn(`[Tunnel] Cloudflare tunnel closed (code: ${code}). Reconnecting with fresh tunnel in 2s...`);
      urlDetected = false;
      setTimeout(startCloudflareTunnel, 2000);
    }
  });
}

function cleanup() {
  isShuttingDown = true;
  console.log('\nGracefully shutting down JobCopilot services...');
  try {
    if (serverProcess) serverProcess.kill();
  } catch (_) {}
  try {
    if (tunnelProcess) tunnelProcess.kill();
  } catch (_) {}
  try {
    fs.writeFileSync(
      path.join(rootDir, 'public_url.txt'),
      'OFFLINE - Run npm run share or double-click START_GLOBAL_APP.bat to start global link.',
      'utf8'
    );
  } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start both server and tunnel
startBackendServer();
setTimeout(startCloudflareTunnel, 1200);
