import { Router, Request, Response } from 'express';
import { store } from '../store/messages.js';
import { CreateMessageRequest, APIResponse } from '../types/index.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats
apiRouter.get('/stats', (_req: Request, res: Response) => {
  res.json(store.getStats());
});

// Channels
apiRouter.get('/channels', (_req: Request, res: Response) => {
  const channels = store.getAllChannels();
  res.json<APIResponse>({ success: true, data: channels });
});

apiRouter.get('/channels/:id', (req: Request, res: Response) => {
  const channel = store.getChannel(req.params.id);
  if (!channel) {
    res.status(404).json<APIResponse>({ success: false, error: 'Channel not found' });
    return;
  }
  res.json<APIResponse>({ success: true, data: channel });
});

apiRouter.get('/channels/:id/messages', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const messages = store.getChannelMessages(req.params.id, limit);
  res.json<APIResponse>({ success: true, data: messages });
});

// Messages
apiRouter.post('/messages', (req: Request, res: Response) => {
  const data = req.body as CreateMessageRequest;

  if (!data.content || !data.authorId || !data.channelId) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields: content, authorId, channelId'
    });
    return;
  }

  const channel = store.getChannel(data.channelId);
  if (!channel) {
    res.status(404).json<APIResponse>({ success: false, error: 'Channel not found' });
    return;
  }

  const message = store.createMessage({
    content: data.content,
    authorId: data.authorId,
    authorName: data.authorName || 'Unknown',
    authorType: data.authorType || 'human',
    channelId: data.channelId,
    threadId: data.threadId,
    replyTo: data.replyTo,
  });

  res.status(201).json<APIResponse>({ success: true, data: message });
});

apiRouter.get('/messages/:id', (req: Request, res: Response) => {
  const message = store.getMessage(req.params.id);
  if (!message) {
    res.status(404).json<APIResponse>({ success: false, error: 'Message not found' });
    return;
  }
  res.json<APIResponse>({ success: true, data: message });
});

// Users
apiRouter.post('/users', (req: Request, res: Response) => {
  const { name, type } = req.body;

  if (!name) {
    res.status(400).json<APIResponse>({ success: false, error: 'Name is required' });
    return;
  }

  const user = store.createUser({ name, type: type || 'human' });
  res.status(201).json<APIResponse>({ success: true, data: user });
});

// AI-specific endpoints
apiRouter.post('/ai/message', (req: Request, res: Response) => {
  // Simplified endpoint for AI to send messages
  const { channelId, content, aiName = 'AI' } = req.body;

  if (!content || !channelId) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields: content, channelId'
    });
    return;
  }

  // Create or get AI user
  const message = store.createMessage({
    content,
    authorId: 'ai-system',
    authorName: aiName,
    authorType: 'ai',
    channelId,
  });

  res.status(201).json<APIResponse>({ success: true, data: message });
});
