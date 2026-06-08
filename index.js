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
  food: null,
  health: null,
  kicks: [],                // [{ time, reason }]
  errors: [],               // [{ time, message }]
  startedAt: new Date()A
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
    .bar-wrap { background: #0f172a; border-radius: 99px; height: 8px; margin-top: 6px; overflow: hidden; }
    .bar { height: 8px; border-radius: 99px; transition: width 0.3s; }
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
      <div class="stat">
        <div class="stat-label">❤️ Health</div>
        <div class="stat-value">${status.health !== null ? Math.round(status.health) + '/20' : '—'}</div>
        ${status.health !== null ? `<div class="bar-wrap"><div class="bar" style="width:${(status.health/20)*100}%;background:#ef4444"></div></div>` : ''}
      </div>
      <div class="stat">
        <div class="stat-label">🍗 Food</div>
        <div class="stat-value">${status.food !== null ? status.food + '/20' : '—'}</div>
        ${status.food !== null ? `<div class="bar-wrap"><div class="bar" style="width:${(status.food/20)*100}%;background:#f59e0b"></div></div>` : ''}
      </div>
    </div>

    <h2>Kick History</h2>
    <table>${kickRows}</table>

    <div class="footer">Auto-refreshes every 10 seconds · Bot started ${new Date(status.startedAt).toLocaleString()}</div>
  </div>
</body>
</html>`);
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

let afkIntervals = [];

function clearAFK() {
  afkIntervals.forEach(clearTimeout);
  afkIntervals = [];
}

function createBot() {
  status.state = 'connecting';

  const bot = mineflayer.createBot({
    host: serverHost,
    port: serverPort,
    username: process.env.MC_EMAIL || 'YourEmail@gmail.com',
    auth: 'microsoft',
    version: '1.21.11',
    checkTimeoutInterval: 60000,
    profilesFolder: process.env.AUTH_CACHE_DIR || './auth-cache'
  });

  bot.on('login', () => {
    status.username = bot.username;
    console.log(`Bot joined as ${bot.username}!`);
  });

  bot.on('spawn', () => {
    status.state = 'online';
    status.connectedAt = new Date();
    console.log('Bot spawned. Waiting for chunks...');
    clearAFK();

    bot.waitForChunksToLoad().then(() => {
      console.log('Chunks loaded. Anti-AFK + Auto-eat active.');
      startAntiAFK(bot);
    }).catch(() => {
      setTimeout(() => startAntiAFK(bot), 5000);
    });
  });

  // Auto-eat: triggers whenever food/health changes
  bot.on('health', () => {
    status.food = bot.food;
    status.health = bot.health;
    if (bot.food < 18) autoEat(bot);
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
    console.log('Bot disconnected. Reconnecting in 20 seconds...');
    clearAFK();
    setTimeout(createBot, 20000);
  });
}

// ── AUTO-EAT ─────────────────────────────────────────────────────────────────
let isEating = false;

async function autoEat(bot) {
  if (isEating || !bot.entity) return;

  // Find any edible item in inventory
  const food = bot.inventory.items().find(item =>
    bot.registry.foodsByName[item.name] !== undefined
  );

  if (!food) {
    console.log('Auto-eat: hungry but no food in inventory.');
    return;
  }

  try {
    isEating = true;
    await bot.equip(food, 'hand');
    await bot.consume();
    console.log(`Auto-eat: ate ${food.name} (food level: ${bot.food}/20).`);
  } catch (err) {
    console.log('Auto-eat error:', err.message);
  } finally {
    isEating = false;
  }
}

// ── ANTI-AFK ──────────────────────────────────────────────────────────────────
function startAntiAFK(bot) {
  function scheduleRandomLook() {
    const delay = 8000 + Math.random() * 12000;
    const t = setTimeout(() => {
      if (!bot.entity) return;
      bot.look((Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.5) * (Math.PI / 3), true);
      scheduleRandomLook();
    }, delay);
    afkIntervals.push(t);
  }

  function scheduleArmSwing() {
    const delay = 25000 + Math.random() * 15000;
    const t = setTimeout(() => {
      if (!bot.entity) return;
      bot.swingArm('right');
      console.log('Anti-AFK: arm swing.');
      scheduleArmSwing();
    }, delay);
    afkIntervals.push(t);
  }

  scheduleRandomLook();
  scheduleArmSwing();
}

// ── START ─────────────────────────────────────────────────────────────────────
createBot();
