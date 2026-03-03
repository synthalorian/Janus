import { Server, Socket } from 'socket.io';
import { store } from '../store/messages.js';
import { CreateMessageRequest } from '../types/index.js';

export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send initial data
    socket.emit('channels:list', store.getAllChannels());

    // Channel management
    socket.on('channel:join', (channelId: string) => {
      socket.join(`channel:${channelId}`);
      console.log(`Client ${socket.id} joined channel ${channelId}`);

      // Send recent messages
      const messages = store.getChannelMessages(channelId, 50);
      socket.emit('messages:history', { channelId, messages });
    });

    socket.on('channel:leave', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
      console.log(`Client ${socket.id} left channel ${channelId}`);
    });

    // Messages
    socket.on('message:send', (data: CreateMessageRequest) => {
      console.log('Message received:', data);

      const message = store.createMessage({
        content: data.content,
        authorId: data.authorId,
        authorName: data.authorName,
        authorType: data.authorType,
        channelId: data.channelId,
        threadId: data.threadId,
        replyTo: data.replyTo,
      });

      // Broadcast to all clients in the channel
      io.to(`channel:${data.channelId}`).emit('message:new', message);
    });

    // Message streaming (for AI responses)
    let currentStreamMessage: { id: string; channelId: string; content: string } | null = null;

    socket.on('message:stream:start', (data: { channelId: string; authorId: string; authorName: string }) => {
      currentStreamMessage = {
        id: `stream-${Date.now()}`,
        channelId: data.channelId,
        content: '',
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

    socket.on('message:stream:end', (messageId: string) => {
      if (currentStreamMessage && currentStreamMessage.id === messageId) {
        // Save the complete message
        const message = store.createMessage({
          content: currentStreamMessage.content,
          authorId: 'ai-stream',
          authorName: 'AI',
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
