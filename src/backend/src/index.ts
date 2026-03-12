import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';
import { setupSocket } from './socket/handler.js';
import { testConnection, closeConnection } from './db/index.js';
import { store } from './db/store.js';
import { runtimeConfig } from './config.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: runtimeConfig.corsOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Simple global rate limiter (temporary)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const maxPerWindow = 200;

  const current = requestCounts.get(ip);
  if (!current || now > current.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= maxPerWindow) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  current.count += 1;
  next();
});

// Routes
app.use('/api', apiRouter);
app.use('/api/auth', authRouter);

// Socket.io
setupSocket(io);


// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await closeConnection();
  process.exit(0);
});

// Start server
const PORT = runtimeConfig.port;

async function maybeMountBots() {
  if (!runtimeConfig.features.botsEnabled) {
    console.log('🤖 Bots feature disabled (JANUS_BOTS_ENABLED=false)');
    return;
  }

  try {
    const modulePath = './routes/' + 'bots.js';
    const mod = await import(modulePath);
    app.use('/api/bots', mod.botRouter);
    console.log('🤖 Bots feature enabled at /api/bots');
  } catch (error) {
    console.warn('⚠️ Bots feature requested but failed to load route module:', error);
  }
}

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Initialize default data
  await store.initializeDefaultData();
  await maybeMountBots();

  httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║                  JANUS SERVER                  ║
╠═══════════════════════════════════════════════╣
║  API:       http://localhost:${PORT}/api        ║
║  Health:    http://localhost:${PORT}/api/health ║
║  Socket:    ws://localhost:${PORT}              ║
║  Bot Socket: ws://localhost:${PORT}/bots        ║
║  Database:  PostgreSQL                         ║
║  Auth:      JWT + API Keys                     ║
║  Bots:      ${runtimeConfig.features.botsEnabled ? 'Enabled (flag)' : 'Disabled'}                 ║
║  Oversight: ${runtimeConfig.features.oversightEnabled ? 'Enabled (flag)' : 'Disabled'}             ║
╚═══════════════════════════════════════════════╝
    `);
  });
}

if (process.env.JANUS_DISABLE_AUTOSTART !== 'true') {
  startServer().catch(console.error);
}

export { app, io, startServer };
