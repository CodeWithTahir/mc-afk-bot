const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
app.use(express.json());

// ── STATUS TRACKING ──────────────────────────────────────────────────────────
const status = {
  state: 'connecting',
  username: null,
  server: null,
  connectedAt: null,
  disconnectedAt: null,
  food: null,
  health: null,
  kicks: [],
  errors: [],
  startedAt: new Date()
};

let currentBot = null;
let reconnectTimer = null;
let manuallyDisconnected = false;

function timeSince(date) {
  if (!date) return null;
  const secs = Math.floor((Date.now() - date) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

// ── CONTROL ENDPOINTS ─────────────────────────────────────────────────────────
const CONTROL_PASSWORD = process.env.CONTROL_PASSWORD || 'admin';

function checkAuth(req, res) {
  const { password } = req.body;
  if (password !== CONTROL_PASSWORD) {
    res.status(401).json({ error: 'Wrong password' });
    return false;
  }
  return true;
}

app.post('/api/disconnect', (req, res) => {
  if (!checkAuth(req, res)) return;
  if (!currentBot) return res.json({ message: 'Bot is not connected.' });
  manuallyDisconnected = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  currentBot.quit('Disconnected from dashboard');
  res.json({ message: 'Bot disconnected.' });
});

app.post('/api/reconnect', (req, res) => {
  if (!checkAuth(req, res)) return;
  manuallyDisconnected = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (currentBot) { currentBot.quit('Reconnecting'); }
  setTimeout(createBot, 1000);
  res.json({ message: 'Reconnecting...' });
});

app.post('/api/shutdown', (req, res) => {
  if (!checkAuth(req, res)) return;
  manuallyDisconnected = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (currentBot) currentBot.quit('Shutdown from dashboard');
  res.json({ message: 'Shutting down...' });
  setTimeout(() => process.exit(0), 1000);
});

app.post('/api/home', (req, res) => {
  if (!checkAuth(req, res)) return;
  if (!currentBot || status.state !== 'online') return res.status(400).json({ error: 'Bot is not online.' });
  currentBot.chat('/home afk');
  res.json({ message: 'Sent: /home afk' });
});

// ── STATUS API ────────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    state: status.state,
    username: status.username,
    server: status.server,
    uptime: status.connectedAt ? timeSince(status.connectedAt) : null,
    food: status.food,
    health: status.health,
    kicks: status.kicks.slice(-10),
    botStartedAt: status.startedAt
  });
});

// ── STATUS PAGE ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const stateColor = { online: '#22c55e', offline: '#ef4444', connecting: '#f59e0b' }[status.state] || '#6b7280';
  const stateLabel = { online: '🟢 Online', offline: '🔴 Offline', connecting: '🟡 Connecting…' }[status.state];
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
  <title>Bot Status</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 560px; width: 100%; }
    h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 24px; color: #f1f5f9; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 99px; font-size: 0.85rem; font-weight: 600; background: ${stateColor}22; color: ${stateColor}; border: 1px solid ${stateColor}55; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .stat { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px 16px; }
    .stat-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 4px; }
    .stat-value { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; word-break: break-all; }
    .bar-wrap { background: #1e293b; border-radius: 99px; height: 8px; margin-top: 6px; overflow: hidden; }
    .bar { height: 8px; border-radius: 99px; }
    h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 24px; }
    td { padding: 8px 10px; border-bottom: 1px solid #1e293b; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .controls { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .btn { flex: 1; min-width: 100px; padding: 10px 16px; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.85; }
    .btn-green { background: #16a34a; color: #fff; }
    .btn-yellow { background: #d97706; color: #fff; }
    .btn-red { background: #dc2626; color: #fff; }
    .btn-blue { background: #2563eb; color: #fff; }
    .pw-wrap { margin-bottom: 16px; }
    .pw-wrap input { width: 100%; padding: 8px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; }
    .msg { font-size: 0.8rem; color: #94a3b8; margin-top: 8px; min-height: 18px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: ${stateColor}; display: inline-block; box-shadow: 0 0 6px ${stateColor}; }
    .footer { text-align: center; font-size: 0.72rem; color: #475569; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span class="dot"></span> Minecraft AFK Bot <span class="badge">${stateLabel}</span></h1>

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
      <div class="stat">
        <div class="stat-label">❤️ Health</div>
        <div class="stat-value">${status.health !== null ? Math.round(status.health) + '/20' : '—'}</div>
        ${status.health !== null ? `<div class="bar-wrap"><div class="bar" style="width:${(status.health / 20) * 100}%;background:#ef4444"></div></div>` : ''}
      </div>
      <div class="stat">
        <div class="stat-label">🍗 Food</div>
        <div class="stat-value">${status.food !== null ? status.food + '/20' : '—'}</div>
        ${status.food !== null ? `<div class="bar-wrap"><div class="bar" style="width:${(status.food / 20) * 100}%;background:#f59e0b"></div></div>` : ''}
      </div>
    </div>

    <h2>Controls</h2>
    <div class="pw-wrap">
      <input type="password" id="pw" placeholder="Enter control password…">
    </div>
    <div class="controls">
      <button class="btn btn-green" onclick="action('reconnect')">🔄 Reconnect</button>
      <button class="btn btn-yellow" onclick="action('disconnect')">⏸ Disconnect</button>
      <button class="btn btn-red" onclick="action('shutdown')">⏹ Shutdown</button>
      <button class="btn btn-blue" onclick="action('home')">🏠 /home afk</button>
    </div>
    <div class="msg" id="msg"></div>

    <h2>Kick History</h2>
    <table>${kickRows}</table>

    <div class="footer">Auto-refreshes every 10s · Started ${new Date(status.startedAt).toLocaleString()}</div>
  </div>

  <script>
    async function action(type) {
      const pw = document.getElementById('pw').value;
      const msg = document.getElementById('msg');
      if (!pw) { msg.style.color = '#f87171'; msg.textContent = 'Enter the control password first.'; return; }
      msg.style.color = '#94a3b8';
      msg.textContent = 'Sending…';
      try {
        const r = await fetch('/api/' + type, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw })
        });
        const d = await r.json();
        msg.style.color = r.ok ? '#4ade80' : '#f87171';
        msg.textContent = d.message || d.error;
        if (r.ok) setTimeout(() => location.reload(), 2000);
      } catch(e) {
        msg.style.color = '#f87171';
        msg.textContent = 'Request failed.';
      }
    }
    setTimeout(() => location.reload(), 10000);
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}.`));

// ── BOT CONFIGURATION ─────────────────────────────────────────────────────────
const rawIP = process.env.SERVER_IP || 'SERVER_IP_HERE';
const [serverHost, serverPortStr] = rawIP.includes(':') ? rawIP.split(':') : [rawIP, '25565'];
const serverPort = parseInt(serverPortStr, 10);
status.server = rawIP;

let afkIntervals = [];
function clearAFK() { afkIntervals.forEach(clearTimeout); afkIntervals = []; }

function createBot() {
  status.state = 'connecting';
  currentBot = mineflayer.createBot({
    host: serverHost,
    port: serverPort,
    username: process.env.MC_EMAIL || 'YourEmail@gmail.com',
    auth: 'microsoft',
    version: '1.21.11',
    checkTimeoutInterval: 60000,
    profilesFolder: process.env.AUTH_CACHE_DIR || './auth-cache'
  });

  const bot = currentBot;

  bot.on('login', () => {
    status.username = bot.username;
    console.log(`Bot joined as ${bot.username}!`);
  });

  bot.on('spawn', () => {
    status.state = 'online';
    status.connectedAt = new Date();
    console.log('Bot spawned. Waiting for chunks...');
    clearAFK();
    bot.waitForChunksToLoad()
      .then(() => { console.log('Chunks loaded. Anti-AFK + Auto-eat active.'); startAntiAFK(bot); })
      .catch(() => setTimeout(() => startAntiAFK(bot), 5000));
  });

  bot.on('health', () => {
    status.food = bot.food;
    status.health = bot.health;
    if (bot.food < 18) autoEat(bot);
  });

  bot.on('kicked', (reason) => {
    let readable = reason;
    try { const p = JSON.parse(reason); readable = p?.value?.translate?.value || p?.text || reason; } catch (_) {}
    console.log('Bot kicked:', readable);
    status.kicks.push({ time: new Date(), reason: readable });
    if (status.kicks.length > 50) status.kicks.shift();
    clearAFK();
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err.message);
    status.errors.push({ time: new Date(), message: err.message });
    if (status.errors.length > 20) status.errors.shift();
    clearAFK();
  });

  bot.on('end', () => {
    status.state = 'offline';
    status.disconnectedAt = new Date();
    clearAFK();
    if (!manuallyDisconnected) {
      console.log('Bot disconnected. Reconnecting in 20 seconds...');
      reconnectTimer = setTimeout(createBot, 20000);
    } else {
      console.log('Bot manually disconnected. Not reconnecting.');
    }
  });
}

// ── AUTO-EAT ──────────────────────────────────────────────────────────────────
let isEating = false;
async function autoEat(bot) {
  if (isEating || !bot.entity) return;
  const food = bot.inventory.items().find(item => bot.registry.foodsByName[item.name] !== undefined);
  if (!food) { console.log('Auto-eat: no food in inventory.'); return; }
  try {
    isEating = true;
    await bot.equip(food, 'hand');
    await bot.consume();
    console.log(`Auto-eat: ate ${food.name} (food: ${bot.food}/20).`);
  } catch (err) {
    console.log('Auto-eat error:', err.message);
  } finally {
    isEating = false;
  }
}

// ── ANTI-AFK ──────────────────────────────────────────────────────────────────
function startAntiAFK(bot) {
  function scheduleRandomLook() {
    const t = setTimeout(() => {
      if (!bot.entity) return;
      bot.look((Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * (Math.PI / 3), true);
      scheduleRandomLook();
    }, 8000 + Math.random() * 12000);
    afkIntervals.push(t);
  }
  function scheduleArmSwing() {
    const t = setTimeout(() => {
      if (!bot.entity) return;
      bot.swingArm('right');
      console.log('Anti-AFK: arm swing.');
      scheduleArmSwing();
    }, 25000 + Math.random() * 15000);
    afkIntervals.push(t);
  }
  scheduleRandomLook();
  scheduleArmSwing();
}

// ── START ─────────────────────────────────────────────────────────────────────
createBot();
