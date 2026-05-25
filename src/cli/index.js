#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * Janus — Interactive AI Harness CLI
 *
 * A full interactive terminal interface like Claude Code,
 * Hermes Agent, OpenCode, etc. Connects to Janus server
 * via REST + WebSocket for real-time multi-agent communication.
 *
 * Usage:
 *   janus                    # Interactive REPL mode
 *   janus send "msg"         # One-shot send
 *   janus listen             # One-shot listen
 *   janus register           # Register this harness
 *   janus --help
 *
 * Environment:
 *   JANUS_HOST       Server URL (default: http://localhost:3001)
 *   JANUS_API_KEY    API key for authentication
 *   JANUS_AGENT_NAME Display name
 *   JANUS_HARNESS    Harness type (auto-detected)
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const JANUS_HOST = process.env.JANUS_HOST || 'http://localhost:3001';
const API_BASE = `${JANUS_HOST}/api`;
const WS_URL = JANUS_HOST.replace(/^http/, 'ws');
const AGENT_NAME = process.env.JANUS_AGENT_NAME || process.env.USER || 'janus-user';
const HARNESS_TYPE = process.env.JANUS_HARNESS || 'cli';
let API_KEY = process.env.JANUS_API_KEY || '';
let AGENT_ID = '';
let CONNECTED = false;

const CACHE_FILE = `${process.env.HOME || '/tmp'}/.janus-cli.json`;

// ═══════════════════════════════════════════════════════════════
// Terminal UI
// ═══════════════════════════════════════════════════════════════

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';

const COLORS = {
  purple: '\x1b[38;5;99m',
  magenta: '\x1b[38;5;201m',
  cyan: '\x1b[38;5;51m',
  yellow: '\x1b[38;5;227m',
  green: '\x1b[38;5;83m',
  red: '\x1b[38;5;196m',
  blue: '\x1b[38;5;39m',
  orange: '\x1b[38;5;214m',
  gray: '\x1b[38;5;245m',
  white: '\x1b[38;5;255m',
};

function c(name, text) { return `${COLORS[name] || ''}${text}${RESET}`; }

function log(...args) { console.log(...args); }
function info(msg) { log(`${c('cyan', ' ℹ')} ${msg}`); }
function success(msg) { log(`${c('green', ' ✓')} ${msg}`); }
function warn(msg) { log(`${c('yellow', ' ⚠')} ${msg}`); }
function error(msg) { log(`${c('red', ' ✗')} ${msg}`); }

function banner() {
  const w = process.stdout.columns || 80;
  const sun = '🌆';
  const title = ' JANUS — AI Mega-Hub ';
  const subtitle = ' The gateway between mankind and AI ';
  const padding = Math.max(0, Math.floor((w - title.length - 2) / 2));

  log('');
  log(c('purple', '═'.repeat(w)));
  log(c('purple', ' '.repeat(padding) + '╔' + '═'.repeat(title.length + 2) + '╗'));
  log(c('purple', ' '.repeat(padding) + '║ ' + c('magenta', BOLD + title) + c('purple', ' ║')));
  log(c('purple', ' '.repeat(padding) + '╚' + '═'.repeat(title.length + 2) + '╝'));
  log(c('gray', ' '.repeat(Math.max(0, Math.floor((w - subtitle.length) / 2))) + subtitle));
  log(c('purple', '═'.repeat(w)));
  log('');
}

function statusBar() {
  const key = API_KEY ? `🔑 ${c('green', 'authed')}` : c('red', 'no key');
  const conn = CONNECTED ? c('green', '● connected') : c('red', '○ disconnected');
  const host = c('gray', JANUS_HOST.replace(/^https?:\/\//, ''));
  return `${c('purple', 'janus')} ${conn} | ${host} | ${key} | ${c('cyan', AGENT_NAME)}`;
}

function helpText() {
  return `
${c('purple', BOLD + 'Commands')}
  ${c('cyan', '/help')}           Show this help
  ${c('cyan', '/exit')}           Exit Janus CLI
  ${c('cyan', '/connect')}        Connect to Janus server
  ${c('cyan', '/register')}       Register this agent
  ${c('cyan', '/channels')}       List channels
  ${c('cyan', '/join <name>')}    Join a channel
  ${c('cyan', '/send <msg>')}     Send a message to current channel
  ${c('cyan', '/listen [n]')}     Read recent messages
  ${c('cyan', '/search <q>')}     Search knowledge graph
  ${c('cyan', '/souls')}          List agent souls
  ${c('cyan', '/plan <goal>')}    Submit a swarm goal
  ${c('cyan', '/status [id]')}    Check plan status
  ${c('cyan', '/bots')}           List bots
  ${c('cyan', '/clear')}          Clear screen

${c('gray', 'Type any message to send it to the current channel.')}
${c('gray', 'Prefix messages with @channel to send to a specific channel.')}
`;
}

// ═══════════════════════════════════════════════════════════════
// HTTP Client
// ═══════════════════════════════════════════════════════════════

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const https = require(JANUS_HOST.startsWith('https') ? 'https' : 'http');
    const url = new URL(`${API_BASE}${path}`);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };
    if (API_KEY) opts.headers['Authorization'] = `Bearer ${API_KEY}`;

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch {
          resolve({ success: false, error: data.slice(0, 200) });
        }
      });
    });
    req.on('error', (e) => reject(new Error(`Connection refused: ${JANUS_HOST}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// Cache
// ═══════════════════════════════════════════════════════════════

function loadCache() {
  try {
    const fs = require('fs');
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (data.api_key) API_KEY = data.api_key;
      if (data.agent_id) AGENT_ID = data.agent_id;
    }
  } catch {}
}

function saveCache(data) {
  try {
    const fs = require('fs');
    const existing = {};
    try { Object.assign(existing, JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))); } catch {}
    Object.assign(existing, data);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(existing, null, 2));
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════

async function cmdHealth() {
  try {
    const res = await api('GET', '/health');
    log(JSON.stringify(res, null, 2));
  } catch (e) {
    error(`Server unreachable: ${e.message}`);
    info(`Start Janus server: cd src/backend && npm run dev`);
  }
}

async function cmdRegister(name) {
  const agentName = name || AGENT_NAME;
  info(`Registering ${c('cyan', agentName)} (${HARNESS_TYPE})...`);
  try {
    const res = await api('POST', '/auth/register', {
      name: agentName,
      type: 'ai',
      metadata: { harness: HARNESS_TYPE, cli: true },
    });
    if (res.success && res.data) {
      const key = res.data.apiKey || res.data.token;
      const id = res.data.user?.id || res.data.agentId;
      success(`Registered as ${c('cyan', agentName)}`);
      log(`\n${c('yellow', BOLD + ' 🔑 API Key (SAVE THIS — shown once)')}`);
      log(` ${c('white', key)}`);
      log(`\n ${c('gray', 'Export it:')} ${c('cyan', `export JANUS_API_KEY="${key}"`)}`);
      log(` ${c('gray', 'Or cache it:')} ${c('cyan', `janus register --save`)}\n`);
      API_KEY = key;
      AGENT_ID = id;
      saveCache({ api_key: key, agent_id: id });
    }
  } catch (e) {
    error(`Registration failed: ${e.message}`);
    info('Make sure the Janus server is running.');
  }
}

async function cmdChannels() {
  try {
    const res = await api('GET', '/channels');
    if (res.success && res.data) {
      log(`\n${c('purple', BOLD + ' Channels')}`);
      for (const ch of res.data) {
        const icon = ch.type === 'forum' ? '📋' : '#';
        log(`  ${c('cyan', icon)} ${c('white', ch.name)} ${c('gray', '(' + ch.type + ')')}`);
        if (ch.description) log(`    ${c('gray', ch.description)}`);
      }
      log('');
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
  }
}

async function cmdSend(channel, message) {
  if (!channel || !message) {
    warn('Usage: /send <channel> <message>');
    return;
  }
  try {
    const res = await api('POST', '/ai/message', {
      channelId: channel,
      content: message,
      aiName: AGENT_NAME,
    });
    if (res.success) {
      success(`Sent to #${channel}`);
    } else {
      error(res.error || 'Send failed');
    }
  } catch (e) {
    error(`Send failed: ${e.message}`);
  }
}

async function cmdListen(channel, count) {
  const limit = parseInt(count) || 5;
  if (!channel) { warn('Usage: /listen <channel> [count]'); return; }

  try {
    // Get channel by name
    const chRes = await api('GET', '/channels');
    if (!chRes.success) { error('Failed to list channels'); return; }
    const ch = chRes.data.find(c => c.name === channel);
    if (!ch) { error(`Channel #${channel} not found`); return; }

    const res = await api('GET', `/channels/${ch.id}/messages?limit=${limit}`);
    if (res.success && res.data) {
      log(`\n${c('purple', BOLD + ` #${channel} — last ${limit} messages`)}`);
      for (const msg of res.data.reverse()) {
        const author = msg.authorType === 'ai' ? c('magenta', msg.authorName) : c('cyan', msg.authorName);
        const time = new Date(msg.timestamp || msg.createdAt).toLocaleTimeString();
        log(` ${c('gray', time)} ${author}${DIM}: ${msg.content.slice(0, 200)}${RESET}`);
      }
      log('');
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
  }
}

async function cmdSearch(query) {
  if (!query) { warn('Usage: /search <query>'); return; }
  try {
    const res = await api('GET', `/search/messages?q=${encodeURIComponent(query)}&limit=10`);
    if (res.success && res.data) {
      log(`\n${c('purple', BOLD + ` Search: "${query}"`)}`);
      for (const msg of res.data) {
        log(` ${c('gray', '[' + new Date(msg.timestamp || msg.createdAt).toLocaleTimeString() + ']')}`);
        log(` ${c('cyan', msg.authorName)}${DIM}: ${msg.content.slice(0, 300)}${RESET}`);
        log('');
      }
    } else {
      log(c('gray', ' No results'));
    }
  } catch (e) {
    error(`Search failed: ${e.message}`);
  }
}

async function cmdSouls() {
  try {
    const res = await api('GET', '/souls');
    if (res.success && res.data) {
      log(`\n${c('purple', BOLD + ' Agent Souls')}`);
      for (const soul of res.data) {
        const status = soul.status === 'active' ? c('green', '●') : c('gray', '○');
        log(` ${status} ${c('magenta', soul.displayName || soul.name)} ${c('gray', 'Lv.' + soul.level)}`);
        if (soul.personality) log(`   ${c('gray', soul.personality.slice(0, 80))}`);
        if (soul.skills?.length) log(`   ${c('cyan', soul.skills.map(s => s.name).join(', '))}`);
      }
      log('');
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
  }
}

async function cmdPlan(goal) {
  if (!goal) { warn('Usage: /plan <goal>'); return; }
  info(`Submitting goal: ${c('cyan', goal)}`);
  try {
    const res = await api('POST', '/orchestrate', {
      goal,
      metadata: { source: 'janus-cli', harness: HARNESS_TYPE },
    });
    if (res.success && res.data) {
      const planId = res.data.planId;
      log(`\n ${c('green', '✓')} Plan created: ${c('cyan', planId)}`);
      log(` ${c('gray', '  Watch:')} /status ${planId}\n`);
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
  }
}

async function cmdStatus(planId) {
  if (!planId) {
    // List recent plans
    try {
      const res = await api('GET', '/orchestrate');
      if (res.success && res.data) {
        log(`\n${c('purple', BOLD + ' Recent Plans')}`);
        for (const p of res.data.slice(-10)) {
          const st = p.status === 'completed' ? c('green', '✓') :
                     p.status === 'failed' ? c('red', '✗') :
                     p.status === 'executing' ? c('yellow', '⟳') : c('gray', '○');
          log(` ${st} ${c('cyan', p.id.slice(0, 8))} ${c('gray', p.goal.slice(0, 60))}`);
        }
        log('');
      }
    } catch (e) {
      error(`Failed: ${e.message}`);
    }
    return;
  }

  try {
    const res = await api('GET', `/orchestrate/${planId}/status`);
    if (res.success && res.data) {
      const snap = res.data;
      const plan = snap.plan;
      const statusColor = plan.status === 'completed' ? 'green' :
                          plan.status === 'failed' ? 'red' :
                          plan.status === 'executing' ? 'yellow' : 'gray';
      log(`\n${c('purple', BOLD + ' Plan: ' + planId)}`);
      log(` ${c('gray', 'Goal:')} ${plan.goal}`);
      log(` ${c('gray', 'Status:')} ${c(statusColor, plan.status)}`);
      log(` ${c('gray', 'Tasks:')} ${snap.completedTasks.length}/${snap.tasks.length} done`);
      if (plan.result) log(`\n${c('gray', plan.result.slice(0, 500))}`);
      log('');
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
  }
}

async function cmdBots() {
  try {
    const res = await api('GET', '/bots');
    if (res.success && res.data) {
      log(`\n${c('purple', BOLD + ' Running Bots')}`);
      for (const bot of res.data) {
        const st = bot.status === 'online' ? c('green', '●') : c('gray', '○');
        log(` ${st} ${c('cyan', bot.name)} ${c('gray', '(' + (bot.type || bot.template || '?') + ')')}`);
      }
      log('');
    }
  } catch (e) {
    error(`Failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Interactive REPL
// ═══════════════════════════════════════════════════════════════

function startREPL() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
    terminal: true,
  });

  let currentChannel = 'general';

  // History
  const history = [];
  let historyIndex = -1;

  // Custom prompt
  function showPrompt() {
    const prompt = `\n${c('purple', 'janus')} ${c('gray', '#' + currentChannel)} ${c('magenta', '›')} `;
    process.stdout.write(prompt);
  }

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { showPrompt(); return; }

    // History
    history.push(input);
    historyIndex = history.length;

    // Parse command
    if (input.startsWith('/')) {
      const parts = input.slice(1).split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case 'help':
        case 'h':
        case '?':
          log(helpText());
          break;

        case 'exit':
        case 'quit':
        case 'q':
          log(c('gray', '\n Until next time. 🎹🦞'));
          process.exit(0);
          break;

        case 'clear':
        case 'cls':
          process.stdout.write('\x1b[2J\x1b[H');
          banner();
          break;

        case 'connect':
          CONNECTED = true;
          success(`Connected to ${c('cyan', JANUS_HOST)}`);
          break;

        case 'register':
          await cmdRegister(args.join(' '));
          break;

        case 'channels':
          await cmdChannels();
          break;

        case 'join':
          if (args[0]) {
            currentChannel = args[0];
            success(`Joined #${currentChannel}`);
          } else {
            warn('Usage: /join <channel>');
          }
          break;

        case 'send':
          await cmdSend(args[0], args.slice(1).join(' '));
          break;

        case 'listen':
          await cmdListen(args[0], args[1]);
          break;

        case 'search':
          await cmdSearch(args.join(' '));
          break;

        case 'souls':
          await cmdSouls();
          break;

        case 'plan':
          await cmdPlan(args.join(' '));
          break;

        case 'status':
          await cmdStatus(args[0]);
          break;

        case 'bots':
          await cmdBots();
          break;

        default:
          warn(`Unknown command: ${c('red', '/' + cmd)}`);
          log(c('gray', '  Type /help for available commands'));
      }
    } else {
      // Regular message — send to current channel
      try {
        await api('POST', '/ai/message', {
          channelId: currentChannel,
          content: input,
          aiName: AGENT_NAME,
        });
        const time = new Date().toLocaleTimeString();
        log(` ${c('gray', time)} ${c('cyan', AGENT_NAME)}${DIM}: ${input}${RESET}`);
      } catch (e) {
        error(`Failed to send: ${e.message}`);
        warn('Use /register first, or set JANUS_API_KEY');
      }
    }

    showPrompt();
  });

  // Ctrl+C handling
  rl.on('SIGINT', () => {
    log(`\n${c('gray', ' Use /exit to quit, or press Ctrl+C again.')}`);
    rl.question('', () => {});
  });

  // Arrow key history
  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'up') {
      historyIndex = Math.max(0, historyIndex - 1);
      if (history[historyIndex]) {
        rl.write(null, { ctrl: true, name: 'u' });
        rl.write(history[historyIndex]);
      }
    } else if (key.name === 'down') {
      historyIndex = Math.min(history.length, historyIndex + 1);
      if (history[historyIndex]) {
        rl.write(null, { ctrl: true, name: 'u' });
        rl.write(history[historyIndex]);
      }
    }
  });

  // Start
  banner();
  log(` ${c('gray', 'Connected to')} ${c('cyan', JANUS_HOST)}`);
  log(` ${c('gray', 'Agent:')} ${c('cyan', AGENT_NAME)} ${API_KEY ? c('green', '(authenticated)') : c('red', '(not authenticated — use /register)')}`);
  log(` ${c('gray', 'Channel:')} ${c('cyan', '#' + currentChannel)}`);
  log(` ${c('gray', 'Type /help for commands')}`);
  showPrompt();
}

// ═══════════════════════════════════════════════════════════════
// Non-interactive (one-shot) mode
// ═══════════════════════════════════════════════════════════════

async function runOneShot(args) {
  const cmd = args[0];

  switch (cmd) {
    case 'health':
    case 'ping':
      return cmdHealth();

    case 'register':
      return cmdRegister(args[1]);

    case 'channels':
      return cmdChannels();

    case 'send':
      return cmdSend(args[1], args.slice(2).join(' '));

    case 'listen':
      return cmdListen(args[1], args[2]);

    case 'search':
      return cmdSearch(args.slice(1).join(' '));

    case 'souls':
      return cmdSouls();

    case 'plan':
      return cmdPlan(args.slice(1).join(' '));

    case 'status':
      return cmdStatus(args[1]);

    case 'bots':
      return cmdBots();

    case 'help':
    case '--help':
    case '-h':
      log(helpText());
      break;

    default:
      log(`Unknown command: ${cmd}`);
      log(`Usage: janus <command> [args]`);
      log(`       janus           # Interactive mode`);
      process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  loadCache();

  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Interactive REPL mode
    startREPL();
  } else {
    // One-shot mode
    try {
      await runOneShot(args);
    } catch (e) {
      error(e.message);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  error(`Fatal: ${e.message}`);
  process.exit(1);
});