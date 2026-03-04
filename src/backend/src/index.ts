import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
import { setupSocket } from './socket/handler.js';
import { testConnection, closeConnection } from './db/index.js';
import { store } from './db/store.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRouter);

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
const PORT = process.env.PORT || 3001;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Initialize default data
  await store.initializeDefaultData();

  httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║                  JANUS SERVER                  ║
╠═══════════════════════════════════════════════╣
║  API:     http://localhost:${PORT}/api          ║
║  Health:  http://localhost:${PORT}/api/health   ║
║  Socket:  ws://localhost:${PORT}                ║
║  Database: PostgreSQL                          ║
╚═══════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);

export { app, io };
