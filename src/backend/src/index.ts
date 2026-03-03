import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
import { setupSocket } from './socket/handler.js';

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

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║                  JANUS SERVER                  ║
╠═══════════════════════════════════════════════╣
║  API:     http://localhost:${PORT}/api          ║
║  Health:  http://localhost:${PORT}/api/health   ║
║  Socket:  ws://localhost:${PORT}                ║
╚═══════════════════════════════════════════════╝
  `);
});

export { app, io };
