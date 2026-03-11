import { Router, Request, Response } from 'express';
import { botForge } from '../bots/service.js';
import { botSpawner } from '../bots/spawner.js';
import { listTemplates, getTemplate } from '../bots/templates.js';
import { requireAuth, requirePermission, optionalAuth } from '../auth/middleware.js';
import { APIResponse } from '../types/index.js';

export const botRouter = Router();

// ==================== Bot Templates ====================

// List available templates
botRouter.get('/templates', (req: Request, res: Response) => {
  const templates = listTemplates();
  
  res.json<APIResponse>({
    success: true,
    data: templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      capabilities: t.capabilities,
      autoStart: t.autoStart,
    }))
  });
});

// Get template details
botRouter.get('/templates/:id', (req: Request, res: Response) => {
  const template = getTemplate(req.params.id);
  
  if (!template) {
    res.status(404).json<APIResponse>({
      success: false,
      error: 'Template not found'
    });
    return;
  }
  
  res.json<APIResponse>({
    success: true,
    data: template
  });
});

// ==================== Autonomous Spawning ====================

// Spawn a bot from template
botRouter.post('/spawn', requireAuth, async (req: Request, res: Response) => {
  const { template, name, displayName, description, config, autoStart } = req.body;
  
  if (!template) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Template is required'
    });
    return;
  }
  
  // Check if template exists
  const templateDef = getTemplate(template);
  if (!templateDef) {
    res.status(400).json<APIResponse>({
      success: false,
      error: `Unknown template: ${template}`
    });
    return;
  }
  
  try {
    const result = await botSpawner.spawnBot({
      template,
      name,
      displayName,
      description,
      ownerId: req.user!.id,
      ownerType: req.user!.type === 'ai' ? 'ai' : 'user',
      config,
    });
    
    const statusCode = result.status === 'spawned' ? 201 : 
                       result.status === 'queued' ? 202 : 400;
    
    res.status(statusCode).json<APIResponse>({
      success: result.status !== 'error',
      data: result
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn bot'
    });
  }
});

// Spawn a bot team
botRouter.post('/teams/spawn', requireAuth, async (req: Request, res: Response) => {
  const { name, description, bots, config, persistent } = req.body;
  
  if (!name || !bots || !Array.isArray(bots) || bots.length === 0) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Name and bots array are required'
    });
    return;
  }
  
  try {
    const result = await botSpawner.spawnTeam({
      name,
      description,
      ownerId: req.user!.id,
      bots,
      config,
      persistent,
    });
    
    res.status(201).json<APIResponse>({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn team'
    });
  }
});

// ==================== Bot CRUD ====================

// List bots
botRouter.get('/', async (req: Request, res: Response) => {
  const { ownerId, category, isPublic, status, limit, offset } = req.query;
  
  try {
    const result = await botForge.listBots({
      ownerId: ownerId as string,
      category: category as string,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json<APIResponse>({
      success: true,
      data: result.bots,
      meta: { total: result.total }
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to list bots'
    });
  }
});

// Get bot by ID
botRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const bot = await botForge.getBot(req.params.id);
    
    if (!bot) {
      res.status(404).json<APIResponse>({
        success: false,
        error: 'Bot not found'
      });
      return;
    }
    
    res.json<APIResponse>({
      success: true,
      data: bot
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to get bot'
    });
  }
});

// Update bot
botRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const { displayName, description, config, status, isPublic } = req.body;
  
  try {
    const bot = await botForge.updateBot(req.params.id, {
      displayName,
      description,
      config,
      status,
      isPublic,
    });
    
    res.json<APIResponse>({
      success: true,
      data: bot
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to update bot'
    });
  }
});

// Terminate/delete bot
botRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await botSpawner.terminateBot(req.params.id, req.user!.id);
    
    res.json<APIResponse>({
      success: true,
      data: { message: 'Bot terminated' }
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to terminate bot'
    });
  }
});

// ==================== Bot Communication ====================

// Send message to bot
botRouter.post('/:id/message', requireAuth, async (req: Request, res: Response) => {
  const { content, metadata } = req.body;
  
  if (!content) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Content is required'
    });
    return;
  }
  
  try {
    const response = await botSpawner.sendToBot(
      req.params.id,
      { content, metadata },
      req.user!.id
    );
    
    res.json<APIResponse>({
      success: response.status === 'success',
      data: response
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    });
  }
});

// Bot-to-bot message
botRouter.post('/:id/message/:targetId', requireAuth, async (req: Request, res: Response) => {
  const { content, metadata } = req.body;
  const { id, targetId } = req.params;
  
  if (!content) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Content is required'
    });
    return;
  }
  
  try {
    // Verify requester owns the source bot
    const bot = await botForge.getBot(id);
    if (!bot || bot.ownerId !== req.user!.id) {
      res.status(403).json<APIResponse>({
        success: false,
        error: 'Not authorized to send messages from this bot'
      });
      return;
    }
    
    const response = await botSpawner.sendToBot(
      targetId,
      { content, metadata },
      id // From bot
    );
    
    res.json<APIResponse>({
      success: response.status === 'success',
      data: response
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send bot-to-bot message'
    });
  }
});

// Broadcast to team
botRouter.post('/teams/:teamId/broadcast', requireAuth, async (req: Request, res: Response) => {
  const { content, metadata } = req.body;
  const { teamId } = req.params;
  
  if (!content) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Content is required'
    });
    return;
  }
  
  try {
    const responses = await botSpawner.broadcastToTeam(teamId, { content, metadata });
    
    const results = Array.from(responses.entries()).map(([botId, response]) => ({
      botId,
      ...response
    }));
    
    res.json<APIResponse>({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to broadcast to team'
    });
  }
});

// ==================== Task Management ====================

// Assign task to bot
botRouter.post('/:id/tasks', requireAuth, async (req: Request, res: Response) => {
  const { description, timeout, payload } = req.body;
  
  if (!description) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Task description is required'
    });
    return;
  }
  
  try {
    const assignment = await botSpawner.assignTask(req.params.id, {
      description,
      timeout,
      payload,
    });
    
    res.status(201).json<APIResponse>({
      success: true,
      data: assignment
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign task'
    });
  }
});

// Get task status
botRouter.get('/:id/tasks/:taskId', requireAuth, async (req: Request, res: Response) => {
  try {
    const task = await botSpawner.getTaskStatus(req.params.id, req.params.taskId);
    
    res.json<APIResponse>({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get task status'
    });
  }
});

// ==================== Status & Monitoring ====================

// Get active bots for user
botRouter.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const bots = await botSpawner.getActiveBots(req.user!.id);
    
    res.json<APIResponse>({
      success: true,
      data: bots
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to get active bots'
    });
  }
});

// Get bot metrics
botRouter.get('/:id/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await botSpawner.getBotMetrics(req.params.id);
    
    res.json<APIResponse>({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics'
    });
  }
});

// Pause bot
botRouter.post('/:id/pause', requireAuth, async (req: Request, res: Response) => {
  try {
    await botForge.updateBotStatus(req.params.id, 'idle');
    
    res.json<APIResponse>({
      success: true,
      data: { message: 'Bot paused' }
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to pause bot'
    });
  }
});

// Resume bot
botRouter.post('/:id/resume', requireAuth, async (req: Request, res: Response) => {
  try {
    await botForge.updateBotStatus(req.params.id, 'online');
    
    res.json<APIResponse>({
      success: true,
      data: { message: 'Bot resumed' }
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to resume bot'
    });
  }
});

// ==================== Bot Commands ====================

// List bot commands
botRouter.get('/:id/commands', async (req: Request, res: Response) => {
  try {
    const commands = await botForge.getBotCommands(req.params.id);
    
    res.json<APIResponse>({
      success: true,
      data: commands
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to get commands'
    });
  }
});

// Create bot command
botRouter.post('/:id/commands', requireAuth, async (req: Request, res: Response) => {
  const { name, description, type, triggers, handler, permissions } = req.body;
  
  if (!name || !type) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Name and type are required'
    });
    return;
  }
  
  try {
    const command = await botForge.createCommand(req.params.id, {
      name,
      description,
      type,
      triggers,
      handler,
      permissions,
    });
    
    res.status(201).json<APIResponse>({
      success: true,
      data: command
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to create command'
    });
  }
});

// Invoke command
botRouter.post('/:id/interact', async (req: Request, res: Response) => {
  const { command, params, channelId, userId } = req.body;
  
  if (!command) {
    res.status(400).json<APIResponse>({
      success: false,
      error: 'Command is required'
    });
    return;
  }
  
  try {
    const result = await botForge.invokeCommand(
      req.params.id,
      command,
      params || {},
      channelId,
      userId
    );
    
    res.json<APIResponse>({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invoke command'
    });
  }
});

// ==================== Bot Messages ====================

// Get bot messages
botRouter.get('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const { limit, offset, unreadOnly } = req.query;
  
  try {
    const messages = await botForge.getBotMessages(req.params.id, {
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      unreadOnly: unreadOnly === 'true',
    });
    
    res.json<APIResponse>({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to get messages'
    });
  }
});

// Mark messages as read
botRouter.post('/:id/messages/read', requireAuth, async (req: Request, res: Response) => {
  const { messageIds } = req.body;
  
  try {
    await botForge.markMessagesAsRead(req.params.id, messageIds);
    
    res.json<APIResponse>({
      success: true,
      data: { message: 'Messages marked as read' }
    });
  } catch (error) {
    res.status(500).json<APIResponse>({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});
