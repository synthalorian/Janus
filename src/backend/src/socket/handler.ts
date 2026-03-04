import { Server, Socket } from 'socket.io';
import { store } from '../db/store.js';
import { CreateMessageRequest } from '../types/index.js';

export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send initial data
    store.getAllChannels().then(channels => {
      socket.emit('channels:list', channels);
    });

    // Channel management
    socket.on('channel:join', async (channelId: string) => {
      socket.join(`channel:${channelId}`);
      console.log(`Client ${socket.id} joined channel ${channelId}`);

      // Send recent messages
      const messages = await store.getChannelMessages(channelId, 50);
      socket.emit('messages:history', { channelId, messages });
    });

    socket.on('channel:leave', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
      console.log(`Client ${socket.id} left channel ${channelId}`);
    });

    // Messages
    socket.on('message:send', async (data: CreateMessageRequest) => {
      console.log('Message received:', data);

      // Ensure user exists
      let user = await store.getUser(data.authorId);
      if (!user) {
        user = await store.createUser({
          name: data.authorName || 'Unknown',
          type: data.authorType || 'human',
        });
      }

      const message = await store.createMessage({
        content: data.content,
        authorId: user.id,
        authorName: user.name,
        authorType: user.type as 'human' | 'ai',
        channelId: data.channelId,
        threadId: data.threadId,
        replyTo: data.replyTo,
      });

      // Broadcast to all clients in the channel
      io.to(`channel:${data.channelId}`).emit('message:new', message);
    });

    // Message streaming (for AI responses)
    let currentStreamMessage: { id: string; channelId: string; content: string; authorId: string; authorName: string } | null = null;

    socket.on('message:stream:start', async (data: { channelId: string; authorId: string; authorName: string }) => {
      currentStreamMessage = {
        id: `stream-${Date.now()}`,
        channelId: data.channelId,
        content: '',
        authorId: data.authorId,
        authorName: data.authorName,
      };

      socket.to(`channel:${data.channelId}`).emit('message:stream:start', {
        messageId: currentStreamMessage.id,
        authorId: data.authorId,
        authorName: data.authorName,
        authorType: 'ai',
      });
    });

    socket.on('message:stream:chunk', (data: { messageId: string; chunk: string }) => {
      if (currentStreamMessage && currentStreamMessage.id === data.messageId) {
        currentStreamMessage.content += data.chunk;
        socket.to(`channel:${currentStreamMessage.channelId}`).emit('message:stream:chunk', data);
      }
    });

    socket.on('message:stream:end', async (messageId: string) => {
      if (currentStreamMessage && currentStreamMessage.id === messageId) {
        // Save the complete message to database
        const message = await store.createMessage({
          content: currentStreamMessage.content,
          authorId: currentStreamMessage.authorId,
          authorName: currentStreamMessage.authorName,
          authorType: 'ai',
          channelId: currentStreamMessage.channelId,
        });

        io.to(`channel:${currentStreamMessage.channelId}`).emit('message:stream:end', message);
        currentStreamMessage = null;
      }
    });

    // Typing indicator
    socket.on('typing:start', (data: { channelId: string; userId: string; userName: string }) => {
      socket.to(`channel:${data.channelId}`).emit('user:typing', data);
    });

    socket.on('typing:stop', (data: { channelId: string; userId: string }) => {
      socket.to(`channel:${data.channelId}`).emit('user:stopped-typing', data);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
