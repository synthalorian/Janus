import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';
import { CreateMessageRequest, APIResponse } from '../types/index.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const dbStats = await store.getStats();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected',
    stats: dbStats,
  });
});

// Stats
apiRouter.get('/stats', async (_req: Request, res: Response) => {
  const stats = await store.getStats();
  res.json(stats);
});

// Channels
apiRouter.get('/channels', async (_req: Request, res: Response) => {
  const channels = await store.getAllChannels();
  res.json<APIResponse>({ success: true, data: channels });
});

apiRouter.get('/channels/:id', async (req: Request, res: Response) => {
  const channel = await store.getChannel(req.params.id);
  if (!channel) {
    res.status(404).json<APIResponse>({ success: false, error: 'Channel not found' });
    return;
  }
  res.json<APIResponse>({ success: true, data: channel });
});

apiRouter.get('/channels/:id/messages', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const messages = await store.getChannelMessages(req.params.id, limit);
  res.json<APIResponse>({ success: true, data: messages });
});

apiRouter.post('/channels', async (req: Request, res: Response) => {
  const { name, type, description } = req.body;

  if (!name || !type) {
    res.status(400).json<APIResponse>({ 
      success: false, 
      error: 'Missing required fields: name, type' 
    });
    return;
  }

  const channel = await store.createChannel({ 
    name, 
    type, 
    description,
    createdBy: req.body.createdBy,
  });
  res.status(201).json<APIResponse>({ success: true, data: channel });
});

// Messages
apiRouter.post('/messages', async (req: Request, res: Response) => {
  const data = req.body as CreateMessageRequest;

  if (!data.content || !data.authorId || !data.channelId) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields: content, authorId, channelId'
    });
    return;
  }

  const channel = await store.getChannel(data.channelId);
  if (!channel) {
    res.status(404).json<APIResponse>({ success: false, error: 'Channel not found' });
    return;
  }

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

  res.status(201).json<APIResponse>({ success: true, data: message });
});

apiRouter.get('/messages/:id', async (req: Request, res: Response) => {
  const message = await store.getMessage(req.params.id);
  if (!message) {
    res.status(404).json<APIResponse>({ success: false, error: 'Message not found' });
    return;
  }
  res.json<APIResponse>({ success: true, data: message });
});

// Users
apiRouter.post('/users', async (req: Request, res: Response) => {
  const { name, type } = req.body;

  if (!name) {
    res.status(400).json<APIResponse>({ success: false, error: 'Name is required' });
    return;
  }

  const user = await store.createUser({ name, type: type || 'human' });
  res.status(201).json<APIResponse>({ success: true, data: user });
});

apiRouter.get('/users/:id', async (req: Request, res: Response) => {
  const user = await store.getUser(req.params.id);
  if (!user) {
    res.status(404).json<APIResponse>({ success: false, error: 'User not found' });
    return;
  }
  res.json<APIResponse>({ success: true, data: user });
});

// AI-specific endpoints
apiRouter.post('/ai/message', async (req: Request, res: Response) => {
  // Simplified endpoint for AI to send messages
  const { channelId, content, aiName = 'AI' } = req.body;

  if (!content || !channelId) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Missing required fields: content, channelId'
    });
    return;
  }

  // Get or create AI user
  let aiUser = await store.getUserByName(aiName);
  if (!aiUser) {
    aiUser = await store.createUser({ name: aiName, type: 'ai' });
  }

  const message = await store.createMessage({
    content,
    authorId: aiUser.id,
    authorName: aiUser.name,
    authorType: 'ai',
    channelId,
  });

  res.status(201).json<APIResponse>({ success: true, data: message });
});

// Graph endpoints
apiRouter.get('/graph/nodes', async (_req: Request, res: Response) => {
  const stats = await store.getStats();
  res.json<APIResponse>({ 
    success: true, 
    data: { 
      nodes: stats.graphNodes, 
      edges: stats.graphEdges 
    } 
  });
});

apiRouter.get('/graph/nodes/:id/related', async (req: Request, res: Response) => {
  const { type, depth } = req.query;
  const related = await store.getRelatedNodes(
    req.params.id, 
    type as string, 
    parseInt(depth as string) || 1
  );
  res.json<APIResponse>({ success: true, data: related });
});

apiRouter.post('/graph/query', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) {
    res.status(400).json<APIResponse>({ success: false, error: 'Query is required' });
    return;
  }
  const results = await store.queryGraph(query);
  res.json<APIResponse>({ success: true, data: results });
});
