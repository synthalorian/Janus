import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';
import { CreateMessageRequest, APIResponse } from '../types/index.js';

export const apiRouter = Router();

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object') return undefined;
  return String(value);
}

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
  res.json({ success: true, data: channels });
});

apiRouter.get('/channels/:id', async (req: Request, res: Response) => {
  const channel = await store.getChannel(String(req.params.id));
  if (!channel) {
    res.status(404).json({ success: false, error: 'Channel not found' });
    return;
  }
  res.json({ success: true, data: channel });
});

apiRouter.get('/channels/:id/messages', async (req: Request, res: Response) => {
  const limit = parseInt(firstQueryValue(req.query.limit) ?? '50', 10);
  const messages = await store.getChannelMessages(String(req.params.id), limit);
  res.json({ success: true, data: messages });
});

apiRouter.post('/channels', async (req: Request, res: Response) => {
  const { name, type, description } = req.body;

  if (!name || !type) {
    res.status(400).json({ 
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
  res.status(201).json({ success: true, data: channel });
});

// Messages
apiRouter.post('/messages', async (req: Request, res: Response) => {
  const data = req.body as CreateMessageRequest;

  if (!data.content || !data.authorId || !data.channelId) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: content, authorId, channelId'
    });
    return;
  }

  const channel = await store.getChannel(data.channelId);
  if (!channel) {
    res.status(404).json({ success: false, error: 'Channel not found' });
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

  res.status(201).json({ success: true, data: message });
});

apiRouter.get('/messages/:id', async (req: Request, res: Response) => {
  const message = await store.getMessage(String(req.params.id));
  if (!message) {
    res.status(404).json({ success: false, error: 'Message not found' });
    return;
  }
  res.json({ success: true, data: message });
});

// Users
apiRouter.post('/users', async (req: Request, res: Response) => {
  const { name, type } = req.body;

  if (!name) {
    res.status(400).json({ success: false, error: 'Name is required' });
    return;
  }

  const user = await store.createUser({ name, type: type || 'human' });
  res.status(201).json({ success: true, data: user });
});

apiRouter.get('/users/:id', async (req: Request, res: Response) => {
  const user = await store.getUser(String(req.params.id));
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: user });
});

// AI-specific endpoints
apiRouter.post('/ai/message', async (req: Request, res: Response) => {
  // Simplified endpoint for AI to send messages
  const { channelId, content, aiName = 'AI' } = req.body;

  if (!content || !channelId) {
    res.status(400).json({
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

  res.status(201).json({ success: true, data: message });
});

// Graph endpoints
apiRouter.get('/graph/nodes', async (_req: Request, res: Response) => {
  const stats = await store.getStats();
  res.json({ 
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
    String(req.params.id),
    firstQueryValue(type),
    parseInt(firstQueryValue(depth) ?? '1', 10)
  );
  res.json({ success: true, data: related });
});

apiRouter.post('/graph/query', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) {
    res.status(400).json({ success: false, error: 'Query is required' });
    return;
  }
  const results = await store.queryGraph(query);
  res.json({ success: true, data: results });
});

// Semantic search endpoints
apiRouter.get('/search/messages', async (req: Request, res: Response) => {
  const { q, limit } = req.query;
  if (!q) {
    res.status(400).json({ success: false, error: 'Query parameter q is required' });
    return;
  }
  const messages = await store.searchMessages(firstQueryValue(q) ?? '', parseInt(firstQueryValue(limit) ?? '20', 10));
  res.json({ success: true, data: messages });
});

apiRouter.get('/search/topic/:topic', async (req: Request, res: Response) => {
  const { limit } = req.query;
  const messages = await store.searchByTopic(String(req.params.topic), parseInt(firstQueryValue(limit) ?? '20', 10));
  res.json({ success: true, data: messages });
});

apiRouter.get('/search/decisions', async (req: Request, res: Response) => {
  const { limit } = req.query;
  const messages = await store.searchDecisions(parseInt(firstQueryValue(limit) ?? '20', 10));
  res.json({ success: true, data: messages });
});

apiRouter.get('/search/sentiment/:sentiment', async (req: Request, res: Response) => {
  const sentiment = String(req.params.sentiment) as 'positive' | 'negative' | 'neutral';
  if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
    res.status(400).json({ success: false, error: 'Sentiment must be positive, negative, or neutral' });
    return;
  }
  const { limit } = req.query;
  const messages = await store.getMessagesBySentiment(sentiment, parseInt(firstQueryValue(limit) ?? '20', 10));
  res.json({ success: true, data: messages });
});

apiRouter.get('/messages/:id/related', async (req: Request, res: Response) => {
  const { depth } = req.query;
  const messages = await store.findRelatedMessages(String(req.params.id), parseInt(firstQueryValue(depth) ?? '2', 10));
  res.json({ success: true, data: messages });
});
