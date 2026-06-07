const mineflayer = require('mineflayer');
const express = require('express');
const app = express();

// ── STATUS TRACKING ──────────────────────────────────────────────────────────
const status = {
  state: 'connecting',      // 'online' | 'offline' | 'connecting'
  username: null,
  server: null,
  connectedAt: null,
  disconnectedAt: null,
  kicks: [],                // [{ time, reason }]
  errors: [],               // [{ time, message }]
  startedAt: new Date()
};

function timeSince(date) {
  if (!date) return null;
  const secs = Math.floor((Date.now() - date) / 1000);
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

// ── WEB SERVER ────────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    state: status.state,
    username: status.username,
    server: status.server,
    uptime: status.connectedAt ? timeSince(status.connectedAt) : null,
    connectedAt: status.connectedAt,
    disconnectedAt: status.disconnectedAt,
    kicks: status.kicks.slice(-10),
    errors: status.errors.slice(-5),
    botStartedAt: status.startedAt
  });
});

app.get('/', (req, res) => {
  const stateColor = { online: '#22c55e', offline: '#ef4444', connecting: '#f59e0b' }[status.state] || '#6b7280';
  const stateLabel = { online: '🟢 Online', offline: '🔴 Offline', connecting: '🟡 Connecting…' }[status.state] || status.state;
  const uptime = status.connectedAt ? timeSince(status.connectedAt) : '—';
  const kickRows = status.kicks.length === 0
    ? '<tr><td colspan="2" style="text-align:center;color:#6b7280;padding:16px">No kicks recorded</td></tr>'
    : [...status.kicks].reverse().slice(0, 10).map(k =>
        `<tr><td style="color:#9ca3af;white-space:nowrap">${new Date(k.time).toLocaleTimeString()}</td><td>${k.reason}</td></tr>`
      ).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="10">
  <title>Bot Status</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 540px; width: 100%; }
    h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 24px; color: #f1f5f9; display: flex; align-items: center; gap: 10px; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 99px; font-size: 0.85rem; font-weight: 600; background: ${stateColor}22; color: ${stateColor}; border: 1px solid ${stateColor}55; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .stat { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px 16px; }
    .stat-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 4px; }
    .stat-value { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; word-break: break-all; }
    h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    td { padding: 8px 10px; border-bottom: 1px solid #1e293b; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 20px; text-align: center; font-size: 0.72rem; color: #475569; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: ${stateColor}; display: inline-block; box-shadow: 0 0 6px ${stateColor}; }
    .controls { display: flex; gap: 12px; margin-top: 24px; }
    .btn { flex: 1; padding: 11px 16px; border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.15s, opacity 0.15s, transform 0.1s; }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-reconnect { background: #1d4ed8; color: #eff6ff; border: 1px solid #2563eb; }
    .btn-reconnect:hover:not(:disabled) { background: #2563eb; }
    .btn-shutdown { background: #7f1d1d; color: #fef2f2; border: 1px solid #991b1b; }
    .btn-shutdown:hover:not(:disabled) { background: #991b1b; }
    .msg { margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; display: none; }
    .msg-ok  { background: #14532d44; color: #4ade80; border: 1px solid #16a34a55; }
    .msg-err { background: #7f1d1d44; color: #f87171; border: 1px solid #991b1b55; }
  </style>
</head>
<body>
  <div class="card">
    <h1>
      <span class="dot"></span>
      Minecraft AFK Bot
      <span class="badge">${stateLabel}</span>
    </h1>

    <div class="grid">
      <div class="stat">
        <div class="stat-label">Username</div>
        <div class="stat-value">${status.username || '—'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Server</div>
        <div class="stat-value">${status.server || '—'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Session Uptime</div>
        <div class="stat-value">${uptime}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Kicks</div>
        <div class="stat-value">${status.kicks.length}</div>
      </div>
    </div>

    <h2>Kick History</h2>
    <table>${kickRows}</table>

    <div class=\"controls\">
      <button class=\"btn btn-reconnect\" id=\"btnReconnect\" onclick=\"doAction('reconnect')\">⟳ Reconnect</button>
      <button class=\"btn btn-shutdown\"  id=\"btnShutdown\"  onclick=\"doAction('shutdown')\">⏻ Shutdown</button>
    </div>
    <div class=\"msg\" id=\"msg\"></div>

    <div class=\"footer\">Auto-refreshes every 10 seconds · Bot started ${new Date(status.startedAt).toLocaleString()}</div>

  </div>

  <script>
    async function doAction(action) {
      if (action === 'shutdown' && !confirm('Shut down the bot? It will stop running until the service restarts.')) return;
      const btnReconnect = document.getElementById('btnReconnect');
      const btnShutdown  = document.getElementById('btnShutdown');
      const msg          = document.getElementById('msg');
      btnReconnect.disabled = true;
      btnShutdown.disabled  = true;
      const activeBtn = document.getElementById(action === 'reconnect' ? 'btnReconnect' : 'btnShutdown');
      const originalText = activeBtn.textContent;
      activeBtn.textContent = 'Working\u2026';
      msg.style.display = 'none';
      msg.className = 'msg';
      try {
        const res  = await fetch('/' + action, { method: 'POST' });
        const data = await res.json();
        msg.textContent   = data.message || 'Done.';
        msg.className     = 'msg msg-ok';
        msg.style.display = 'block';
      } catch (err) {
        msg.textContent   = 'Request failed: ' + err.message;
        msg.className     = 'msg msg-err';
        msg.style.display = 'block';
      } finally {
        activeBtn.textContent = originalText;
        btnReconnect.disabled = false;
        btnShutdown.disabled  = false;
      }
    }
  </script>
</body>
</html>`);

});

app.post('/shutdown', (req, res) => {
  console.log('Shutdown requested via HTTP.');
  res.json({ ok: true, message: 'Bot shutting down.' });
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (currentBot) {
    currentBot.quit('Shutdown requested');
    currentBot = null;
  }
  setTimeout(() => process.exit(0), 500);
});

app.post('/reconnect', (req, res) => {
  console.log('Reconnect requested via HTTP.');
  res.json({ ok: true, message: 'Bot reconnecting in 3 seconds.' });
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (currentBot) {
    currentBot.quit('Reconnect requested');
    currentBot = null;
  }
  reconnectTimer = setTimeout(createBot, 3000);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}.`);
});

// ── BOT CONFIGURATION ─────────────────────────────────────────────────────────
const rawIP = process.env.SERVER_IP || 'SERVER_IP_HERE';
const [serverHost, serverPortStr] = rawIP.includes(':')
  ? rawIP.split(':')
  : [rawIP, '25565'];
const serverPort = parseInt(serverPortStr, 10);

status.server = rawIP;

let currentBot = null;
let reconnectTimer = null;

function createBot() {
  status.state = 'connecting';

  const bot = mineflayer.createBot({
    host: serverHost,
    port: serverPort,
    username: process.env.MC_EMAIL || 'YourEmail@gmail.com',
    auth: 'microsoft',
    version: '1.21.11',
    checkTimeoutInterval: 60000
  });

  currentBot = bot;

  bot.on('login', () => {
    status.username = bot.username;
    console.log(`Bot joined as ${bot.username}!`);
  });

  bot.on('spawn', () => {
    status.state = 'online';
    status.connectedAt = new Date();
    console.log('Bot spawned and connected.');
  });

  bot.on('kicked', (reason) => {
    let readable = reason;
    try {
      const parsed = JSON.parse(reason);
      readable = parsed?.value?.translate?.value || parsed?.text || reason;
    } catch (_) {}
    console.log('Bot kicked:', readable);
    status.kicks.push({ time: new Date(), reason: readable });
    if (status.kicks.length > 50) status.kicks.shift();
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err.message);
    status.errors.push({ time: new Date(), message: err.message });
    if (status.errors.length > 20) status.errors.shift();
  });

  bot.on('end', () => {
    if (currentBot === bot) {
      currentBot = null;
      status.state = 'offline';
      status.disconnectedAt = new Date();
      console.log('Bot disconnected. Reconnecting in 20 seconds...');
      reconnectTimer = setTimeout(createBot, 20000);
    } else {
      status.state = 'offline';
      status.disconnectedAt = new Date();
    }
  });
}

// ── START ─────────────────────────────────────────────────────────────────────
createBot();
