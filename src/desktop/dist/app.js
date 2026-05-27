// Janus Desktop - Frontend Application
try {
  // Diagnostic: signal that app.js loaded
  var _jsLoaded = document.getElementById('output');
  if (_jsLoaded) _jsLoaded.textContent = 'app.js LOADED! Running...';
  console.log('app.js: top-level execution started');

  const API_BASE = 'http://localhost:3001';

// ── Tauri / Browser Detection ──────────────────────
// In Tauri 2, window.__TAURI__ requires the @tauri-apps/api npm package.
// Without it, __TAURI_INTERNALS__ is still available for low-level IPC.
// We default to HTTP API calls (fetch) for reliability.
const isTauri = false; // No high-level Tauri API available without npm package
const invoke = null;

// Use HTTP API for all backend calls instead of Tauri IPC

// ── State ──────────────────────────────────────────
let state = {
  authenticated: false,
  userName: 'Desktop Explorer',
  userId: null,
  authToken: null,
  currentView: 'dashboard',
  channelList: [],
  currentChannelId: null,
};

// ── Generic API Call ───────────────────────────────
async function apiCall(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  return res.json();
}

// ── Auth ───────────────────────────────────────────
async function handleAuth(event) {
  event.preventDefault();
  const name = document.getElementById('auth-name').value;
  const type = document.getElementById('auth-type').value;

  const result = await apiCall('POST', '/api/auth/register', { name, type });

  if (result.success && result.data) {
    state.authenticated = true;
    state.userName = result.data.user.name;
    state.userId = result.data.user.id;
    state.authToken = result.data.token;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-name').textContent = state.userName;
    document.getElementById('user-avatar').textContent = state.userName.substring(0, 2).toUpperCase();
    loadView('dashboard');
  } else {
    const err = document.getElementById('auth-error');
    err.textContent = result.error || 'Authentication failed';
    err.style.display = 'block';
  }
}

// ── View Switching ─────────────────────────────────
const VIEW_TITLES = {
  dashboard: 'DASHBOARD',
  chat: 'CHAT',
  bots: 'BOT FORGE',
  souls: 'SOULS',
  swarm: 'SWARM',
  oversight: 'OVERSIGHT',
  graph: 'KNOWLEDGE GRAPH',
  health: 'HEALTH',
  keys: 'API KEYS',
};

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  document.getElementById('view-title').textContent = VIEW_TITLES[view] || view.toUpperCase();
  loadView(view);
}

async function loadView(view) {
  const body = document.getElementById('main-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:60px;"><div class="spinner" style="margin:0 auto;"></div></div>';
  try {
    body.innerHTML = await renderView(view);
  } catch (e) {
    body.innerHTML = `<div class="flash flash-alert" style="margin:16px;">╱ Error: ${escapeHtml(e.message || 'Failed to load view')}</div>`;
    console.error('View error:', e);
  }
}

async function renderView(view) {
  try {
    switch (view) {
      case 'dashboard': return await renderDashboard();
      case 'chat': return await renderChat();
      case 'bots': return await renderBots();
      case 'souls': return await renderSouls();
      case 'swarm': return await renderSwarm();
      case 'oversight': return await renderOversight();
      case 'graph': return await renderGraph();
      case 'health': return await renderHealth();
      case 'keys': return await renderKeys();
      default: return '<p>View not found</p>';
    }
  } catch (e) {
    return `<div class="flash flash-alert">╱ ${e.message || 'Error loading view'}</div>`;
  }
}

// ── Dashboard ──────────────────────────────────────
async function renderDashboard() {
  const health = await apiCall('GET', '/api/health');
  const stats = health.stats || {};
  const features = health.features || {};

  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${stats.users || '—'}</div><div class="stat-label">Users</div></div>
      <div class="stat-card"><div class="stat-value">${stats.channels || '—'}</div><div class="stat-label">Channels</div></div>
      <div class="stat-card"><div class="stat-value">${stats.messages || '—'}</div><div class="stat-label">Messages</div></div>
      <div class="stat-card"><div class="stat-value">${stats.graphNodes || '—'}</div><div class="stat-label">Graph Nodes</div></div>
      <div class="stat-card"><div class="stat-value">${stats.graphEdges || '—'}</div><div class="stat-label">Graph Edges</div></div>
    </div>
    <div class="two-col">
      <div class="janus-card">
        <div class="janus-card-header"><span class="janus-card-title">🎹 Welcome to Janus</span></div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin:0;">
          Janus is your AI communication hub with built-in knowledge graphs, 
          bot orchestration, and multi-agent swarm capabilities.
        </p>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" data-view="chat">💬 Start Chatting</button>
          <button class="btn btn-secondary" data-view="bots">🤖 Manage Bots</button>
          <button class="btn btn-secondary" data-view="swarm">🐝 Launch Swarm</button>
        </div>
      </div>
      <div class="janus-card">
        <div class="janus-card-header"><span class="janus-card-title">🔌 System</span></div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:2;">
          <div><span style="color:var(--text-muted);">Status:</span> <span class="badge badge-${health.status === 'healthy' ? 'success' : 'warning'}">${health.status || 'unknown'}</span></div>
          <div><span style="color:var(--text-muted);">Database:</span> <span class="badge badge-${health.database === 'connected' ? 'success' : 'error'}">${health.database || 'unknown'}</span></div>
          <div><span style="color:var(--text-muted);">Agent:</span> <span style="font-family:var(--font-mono)">${state.userName}</span></div>
        </div>
      </div>
    </div>
    ${Object.keys(features).length ? `<div class="section-title">Feature Flags</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${Object.entries(features).map(([k, v]) => `<span class="badge badge-${v ? 'success' : 'error'}">${v ? '✓' : '✗'} ${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>`).join('')}
      </div>` : ''}
  `;
}

// ── Chat ───────────────────────────────────────────
async function renderChat() {
  const channelsRes = await apiCall('GET', '/api/channels');
  const channels = channelsRes.data || [];
  let messagesHtml = '';
  let channelListHtml = '';

  channelListHtml = channels.map(ch => `
    <a class="channel-item ${state.currentChannelId === ch.id ? 'active' : ''}" 
       data-channel-id="${ch.id}" style="cursor:pointer;text-decoration:none;">
      <span class="channel-indicator ${ch.type}"></span>
      <span># ${ch.name}</span></a>
  `).join('') || '<div style="font-size:11px;color:var(--text-muted);padding:8px 4px;">No channels</div>';

  if (state.currentChannelId) {
    const msgsRes = await apiCall('GET', `/api/channels/${state.currentChannelId}/messages?limit=50`);
    const messages = msgsRes.data || [];
    const currentChannel = channels.find(c => c.id === state.currentChannelId);
    messagesHtml = messages.map(msg => `
      <div class="chat-message ${msg.authorType === 'human' ? 'user' : 'ai'}">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.7;font-family:var(--font-mono);">
          ${msg.authorName || msg.authorId}${msg.authorType === 'ai' ? ' <span style="color:var(--accent-cyan);">● AI</span>' : ''}
        </div>
        <div>${escapeHtml(msg.content)}</div>
        <div class="chat-timestamp">${msg.timestamp ? timeAgo(msg.timestamp) : ''}</div>
      </div>
    `).join('') || `<div class="chat-empty"><div class="chat-empty-icon">💬</div>
      <div style="font-size:13px;">No messages in this channel yet</div></div>`;
  }

  return `
    <div style="display:flex;gap:20px;height:calc(100vh - 130px);">
      <div style="width:200px;flex-shrink:0;">
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;padding:0 4px 8px;border-bottom:1px solid var(--border-color);margin-bottom:8px;">Channels</div>
        ${channelListHtml}
      </div>
      <div class="chat-container" style="flex:1;">
        ${state.currentChannelId ? `
          <div class="chat-messages" id="messages-container">
            ${messagesHtml}
          </div>
          <div class="chat-input-bar">
            <form id="chat-form" style="margin:0;">
              <div class="chat-input-wrapper">
                <textarea id="chat-input-field" class="chat-input" placeholder="Message…" rows="1"></textarea>
                <button type="submit" class="chat-send-btn">SEND</button>
              </div>
              <div class="chat-input-hint">Enter to send · Shift+Enter for newline</div>
            </form>
          </div>
        ` : `<div class="chat-empty"><div class="chat-empty-icon">💬</div>
          <div style="font-size:16px;font-family:var(--font-display);">Select a Channel</div>
          <div style="font-size:12px;color:var(--text-muted);">Choose a channel from the list</div></div>`}
      </div>
    </div>
  `;
}

async function selectChannel(id) {
  state.currentChannelId = id;
  await loadView('chat');
}

async function sendChatMessage(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input-field');
  const content = input.value.trim();
  if (!content || !state.currentChannelId) return;

  await apiCall('POST', '/api/messages', {
    content,
    authorId: state.userId || 'unknown',
    authorName: state.userName,
    authorType: 'human',
    channelId: state.currentChannelId,
  });
  input.value = '';
  // Refresh messages
  const msgsRes = await apiCall('GET', `/api/channels/${state.currentChannelId}/messages?limit=50`);
  const messages = msgsRes.data || [];
  const container = document.getElementById('messages-container');
  if (container) {
    container.innerHTML = messages.map(msg => `
      <div class="chat-message ${msg.authorType === 'human' ? 'user' : 'ai'}">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;opacity:0.7;font-family:var(--font-mono);">${msg.authorName}</div>
        <div>${escapeHtml(msg.content)}</div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }
}

// ── Bots ───────────────────────────────────────────
async function renderBots() {
  const botsRes = await apiCall('GET', '/api/bots');
  const bots = botsRes.data || [];

  return `
    <div class="janus-card">
      <div class="janus-card-header"><span class="janus-card-title">⚙️ Spawn New Bot</span></div>
      <form id="spawn-bot-form" style="margin:0;">
        <div class="two-col" style="margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:10px;font-family:var(--font-mono);color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Bot Name</label>
            <input type="text" id="bot-name" class="janus-input" placeholder="MyBot" required>
          </div>
          <div>
            <label style="display:block;font-size:10px;font-family:var(--font-mono);color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Template</label>
            <select id="bot-template" class="janus-select">
              <option value="coordinator">Coordinator</option>
              <option value="researcher">Researcher</option>
              <option value="coder">Coder</option>
              <option value="analyst">Analyst</option>
              <option value="watcher">Watcher</option>
              <option value="responder">Responder</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">🤖 Spawn Bot</button>
      </form>
    </div>
    <div class="section-title">Active Bots</div>
    ${bots.length ? `<div class="cards-grid">${bots.map(bot => `
      <div class="janus-card" style="padding:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:24px;">🤖</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${bot.displayName || bot.name}</div>
            <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);">${(bot.id || '').substring(0, 8)}…</div>
          </div>
          <span class="badge badge-${bot.status === 'online' ? 'success' : (bot.status === 'error' ? 'error' : 'warning')}">${bot.status}</span>
        </div>
        ${bot.description ? `<p style="font-size:11px;color:var(--text-secondary);margin:0 0 12px;">${bot.description}</p>` : ''}
        ${bot.capabilities?.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;">${bot.capabilities.map(c => `<span class="badge badge-primary">${c}</span>`).join('')}</div>` : ''}
      </div>
    `).join('')}</div>` : `
    <div class="janus-card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:40px;margin-bottom:12px;opacity:0.5;">🤖</div>
      <p style="color:var(--text-muted);margin:0;font-size:13px;">No bots deployed yet</p>
    </div>`}`;
}

async function spawnBot(event) {
  event.preventDefault();
  const name = document.getElementById('bot-name').value;
  const template = document.getElementById('bot-template').value;
  await apiCall('POST', '/api/bots/spawn', { template, name });
  await loadView('bots');
}

// ── Souls ──────────────────────────────────────────
async function renderSouls() {
  const soulsRes = await apiCall('GET', '/api/souls');
  const souls = soulsRes.data || [];
  return souls.length ? `<div class="cards-grid">${souls.map(soul => `
    <div class="janus-card" style="padding:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--text-inverse);flex-shrink:0;">${(soul.name || '??').substring(0, 2).toUpperCase()}</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${soul.displayName || soul.name}</div>
          <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);">${soul.archetype || 'unknown'} · Lv.${soul.level || 1}</div>
        </div>
        <span class="badge badge-${soul.status === 'active' ? 'success' : 'warning'}">${soul.status}</span>
      </div>
      ${soul.backstory ? `<p style="font-size:11px;color:var(--text-secondary);line-height:1.6;margin:0 0 12px;font-style:italic;">&ldquo;${escapeHtml(soul.backstory.substring(0, 120))}&rdquo;</p>` : ''}
      ${soul.expertiseTags?.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">${soul.expertiseTags.map(t => `<span class="badge badge-primary">${t}</span>`).join('')}</div>` : ''}
    </div>
  `).join('')}</div>` : `
    <div class="janus-card" style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;opacity:0.5;">👻</div>
      <h2 style="font-family:var(--font-display);font-size:18px;color:var(--text-secondary);margin:0 0 8px;">No Souls Found</h2>
      <p style="color:var(--text-muted);font-size:13px;margin:0;">Connect an AI harness to spawn your first soul.</p>
    </div>`;
}

// ── Swarm ──────────────────────────────────────────
async function renderSwarm() {
  const plansRes = await apiCall('GET', '/api/orchestrate');
  const plans = plansRes.data || [];
  return `
    <div class="janus-card">
      <div class="janus-card-header"><span class="janus-card-title">🎯 Submit Orchestration Goal</span></div>
      <form id="goal-form" style="margin:0;">
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:10px;font-family:var(--font-mono);color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Goal</label>
          <textarea id="goal-input" class="janus-textarea" rows="3" placeholder="e.g., Research latest Rust async runtimes..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary">🐝 Launch Swarm</button>
      </form>
    </div>
    <div class="section-title">Active Plans</div>
    ${plans.length ? `<div class="cards-grid">${plans.map(p => `
      <div class="janus-card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--text-primary);">${escapeHtml((p.goal || 'Untitled').substring(0, 50))}</span>
          <span class="badge badge-${p.status === 'completed' ? 'success' : (p.status === 'failed' ? 'error' : 'warning')}">${p.status}</span>
        </div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);">ID: ${(p.id || '').substring(0, 8)}…</div>
      </div>
    `).join('')}</div>` : `
    <div class="janus-card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:36px;margin-bottom:8px;opacity:0.5;">🐝</div>
      <p style="color:var(--text-muted);margin:0;font-size:13px;">No swarm plans yet</p>
    </div>`}`;
}

async function submitGoal(event) {
  event.preventDefault();
  const goal = document.getElementById('goal-input').value;
  await apiCall('POST', '/api/orchestrate', { goal });
  await loadView('swarm');
}

// ── Oversight ──────────────────────────────────────
async function renderOversight() {
  const statsRes = await apiCall('GET', '/api/oversight/stats');
  const stats = statsRes.data || {};
  const pendingRes = await apiCall('GET', '/api/oversight/pending');
  const pending = pendingRes.data || [];
  return `
    <div class="stats-grid" style="grid-template-columns:repeat(4, 1fr);">
      <div class="stat-card"><div class="stat-value" style="font-size:24px;">${stats.pending || 0}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:24px;color:var(--success);">${stats.approved || 0}</div><div class="stat-label">Approved</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:24px;color:var(--error);">${stats.rejected || 0}</div><div class="stat-label">Rejected</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:24px;color:var(--accent-secondary);">${stats.total || 0}</div><div class="stat-label">Total</div></div>
    </div>
    <div class="section-title">Pending Review</div>
    ${pending.length ? `<div class="cards-grid">${pending.map(a => `
      <div class="janus-card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;color:var(--text-primary);">${a.actionType}</span>
          <span class="badge badge-warning">${a.oversightLevel}</span>
        </div>
        <p style="font-size:11px;color:var(--text-secondary);margin:0 0 8px;">${escapeHtml(a.description)}</p>
      </div>
    `).join('')}</div>` : `
    <div class="janus-card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:36px;margin-bottom:8px;opacity:0.5;">⚖️</div>
      <p style="color:var(--text-muted);margin:0;font-size:13px;">No pending oversight actions</p>
    </div>`}`;
}

// ── Graph ──────────────────────────────────────────
async function renderGraph() {
  const graphRes = await apiCall('GET', '/api/graph/nodes');
  const g = graphRes.data || {};
  return `
    <div class="stats-grid" style="grid-template-columns:repeat(2, 1fr);">
      <div class="stat-card"><div class="stat-value">${g.nodes || 0}</div><div class="stat-label">Nodes</div></div>
      <div class="stat-card"><div class="stat-value">${g.edges || 0}</div><div class="stat-label">Edges</div></div>
    </div>
    <div class="janus-card" style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;opacity:0.5;">🕸️</div>
      <p style="color:var(--text-muted);font-size:13px;margin:0;">Knowledge graph visualization coming soon.</p>
    </div>`;
}

// ── Health ─────────────────────────────────────────
async function renderHealth() {
  const health = await apiCall('GET', '/api/health');
  if (health.status === 'error') {
    return `<div class="flash flash-alert">╱ Cannot connect to Janus API</div>`;
  }
  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr);">
      <div class="stat-card"><div class="stat-value"><span class="badge badge-${health.status === 'healthy' ? 'success' : 'error'}" style="font-size:14px;padding:4px 12px;">${health.status || 'unknown'}</span></div><div class="stat-label">Server</div></div>
      <div class="stat-card"><div class="stat-value"><span class="badge badge-${health.database === 'connected' ? 'success' : 'error'}" style="font-size:14px;padding:4px 12px;">${health.database || 'unknown'}</span></div><div class="stat-label">Database</div></div>
      <div class="stat-card"><div class="stat-value" style="font-size:14px;font-family:var(--font-mono);">${health.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '—'}</div><div class="stat-label">Last Check</div></div>
    </div>
    ${health.features ? `<div class="section-title">Feature Flags</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${Object.entries(health.features).map(([k, v]) => `<span class="badge badge-${v ? 'success' : 'error'}">${v ? '✓' : '✗'} ${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>`).join('')}</div>` : ''}`;
}

// ── API Keys ───────────────────────────────────────
async function renderKeys() {
  const keysRes = await apiCall('GET', '/api/auth/keys');
  const keys = keysRes.data || [];
  return `
    <div class="janus-card">
      <div class="janus-card-header"><span class="janus-card-title">🔑 Manage API Keys</span></div>
      <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;">API keys are managed via the Janus web app at <code style="font-size:11px;background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">/api_keys</code> or the API directly.</p>
    </div>
    <div class="section-title">Active Keys (${keys.length})</div>
    ${keys.length ? `<div class="janus-card" style="padding:0;overflow:hidden;">
      <table class="janus-table"><thead><tr><th>Name</th><th>Prefix</th><th>Permissions</th></tr></thead>
      <tbody>${keys.map(k => `<tr><td style="font-weight:600;color:var(--text-primary);">${k.name}</td>
        <td><code style="font-family:var(--font-mono);font-size:10px;background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">${k.prefix}…</code></td>
        <td>${(k.permissions || ['read']).map(p => `<span class="badge badge-primary">${p}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table>
    </div>` : `<div class="janus-card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:36px;margin-bottom:8px;opacity:0.5;">🔑</div>
      <p style="color:var(--text-muted);margin:0;font-size:13px;">No API keys</p></div>`}`;
}

// ── Theme System ───────────────────────────────────
const THEMES = {
  'synthwave84': { name: "Synthwave '84", icon: '🌆' },
  'synthwave-midnight': { name: 'Synthwave Midnight', icon: '🌃' },
  'synthwave-dawn': { name: 'Synthwave Dawn', icon: '🌅' },
  'dark': { name: 'Dark', icon: '🌑' },
  'light': { name: 'Light', icon: '☀️' },
  'cyberpunk': { name: 'Cyberpunk', icon: '⚡' },
  'fallout-terminal': { name: 'Fallout Terminal', icon: '📟' },
};

function openThemeDialog() {
  const grid = document.getElementById('theme-grid');
  const current = document.documentElement.getAttribute('data-theme') || 'synthwave84';
  grid.innerHTML = Object.entries(THEMES).map(([key, t]) => `
    <button class="theme-btn ${key === current ? 'active' : ''}" data-theme-key="${key}">
      <span class="theme-btn-icon">${t.icon}</span>
      <span>${t.name}</span>
    </button>
  `).join('');
  document.getElementById('theme-dialog').showModal();
}

function switchTheme(key) {
  if (THEMES[key]) {
    document.documentElement.setAttribute('data-theme', key);
    localStorage.setItem('janus-theme', key);
  }
  document.getElementById('theme-dialog').close();
}

function loadTheme() {
  const saved = localStorage.getItem('janus-theme');
  if (saved && THEMES[saved]) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

// ── Utilities ──────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Event Delegation ───────────────────────────────
function setupEventDelegation() {
  // Sidebar navigation: data-view clicks
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link[data-view]');
    if (link) {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) switchView(view);
    }
  });

  // Sidebar action buttons: data-action clicks
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link[data-action]');
    if (link) {
      e.preventDefault();
      const action = link.dataset.action;
      if (action === 'theme') openThemeDialog();
    }
  });

  // Global click delegation for dynamically rendered content
  document.addEventListener('click', (e) => {
    // data-view buttons (dashboard quick actions, etc.)
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn && !e.target.closest('.sidebar-link')) {
      e.preventDefault();
      const view = viewBtn.dataset.view;
      if (view && VIEW_TITLES[view]) switchView(view);
      return;
    }

    // Theme dialog backdrop click to close
    const dialog = document.getElementById('theme-dialog');
    if (dialog && e.target === dialog) {
      dialog.close();
      return;
    }

    // Theme close button
    if (e.target.closest('#theme-dialog-close')) {
      document.getElementById('theme-dialog').close();
      return;
    }

    // Theme buttons in dialog
    const themeBtn = e.target.closest('.theme-btn[data-theme-key]');
    if (themeBtn) {
      switchTheme(themeBtn.dataset.themeKey);
      return;
    }

    // Channel selection in chat view
    const channelLink = e.target.closest('.channel-item[data-channel-id]');
    if (channelLink) {
      e.preventDefault();
      selectChannel(channelLink.dataset.channelId);
      return;
    }
  });

  // Form delegation for dynamically added forms
  document.addEventListener('submit', (e) => {
    // Auth form
    if (e.target.matches('#auth-form')) {
      handleAuth(e);
      return;
    }
    // Chat form
    if (e.target.matches('#chat-form')) {
      sendChatMessage(e);
      return;
    }
    // Spawn bot form
    if (e.target.matches('#spawn-bot-form')) {
      spawnBot(e);
      return;
    }
    // Goal form
    if (e.target.matches('#goal-form')) {
      submitGoal(e);
      return;
    }
  });

  // Chat input auto-resize (delegated)
  document.addEventListener('input', (e) => {
    if (e.target.matches('#chat-input-field')) {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }
  });

  // Enter key handler for chat
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const input = document.getElementById('chat-input-field');
      if (input && document.activeElement === input) {
        e.preventDefault();
        sendChatMessage(e);
      }
    }
  });
}

// ── Init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  // Show auth screen by default, hide main app
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';

  // Set up all event delegation
  setupEventDelegation();
});