import { Router, Request, Response } from 'express';
import { botForge } from '../bots/service.js';
import { botSpawner } from '../bots/spawner.js';
import { listTemplates, getTemplate } from '../bots/templates.js';
import { requireAuth, requirePermission, optionalAuth } from '../auth/middleware.js';
import { APIResponse } from '../types/index.js';

export const botRouter = Router();

// Helper to safely get string param
const param = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
};

// ==================== Bot Templates ====================

// List available templates
botRouter.get('/templates', (req: Request, res: Response) => {
  const templates = listTemplates();
  
  res.json({
    success: true,
    data: templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      capabilities: t.capabilities,
      autoStart: t.autoStart,
    }))
  } as APIResponse);
});

// Get template details
botRouter.get('/templates/:id', (req: Request, res: Response) => {
  const template = getTemplate(param(req, 'id'));
  
  if (!template) {
    res.status(404).json({
      success: false,
      error: 'Template not found'
    } as APIResponse);
    return;
  }
  
  res.json({
    success: true,
    data: template
  } as APIResponse);
});

// ==================== Autonomous Spawning ====================

// Spawn a bot from template
botRouter.post('/spawn', requireAuth, async (req: Request, res: Response) => {
  const { template, name, displayName, description, config, autoStart } = req.body;
  
  if (!template) {
    res.status(400).json({
      success: false,
      error: 'Template is required'
    } as APIResponse);
    return;
  }
  
  // Check if template exists
  const templateDef = getTemplate(template);
  if (!templateDef) {
    res.status(400).json({
      success: false,
      error: `Unknown template: ${template}`
    } as APIResponse);
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
    
    res.status(statusCode).json({
      success: result.status !== 'error',
      data: result
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn bot'
    } as APIResponse);
  }
});

// Spawn a bot team
botRouter.post('/teams/spawn', requireAuth, async (req: Request, res: Response) => {
  const { name, description, bots, config, persistent } = req.body;
  
  if (!name || !bots || !Array.isArray(bots) || bots.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Name and bots array are required'
    } as APIResponse);
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
    
    res.status(201).json({
      success: true,
      data: result
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn team'
    } as APIResponse);
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
    
    res.json({
      success: true,
      data: result.bots,
      meta: { total: result.total }
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list bots'
    } as APIResponse);
  }
});

// Get bot by ID
botRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const bot = await botForge.getBot(param(req, 'id'));
    
    if (!bot) {
      res.status(404).json({
        success: false,
        error: 'Bot not found'
      } as APIResponse);
      return;
    }
    
    res.json({
      success: true,
      data: bot
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get bot'
    } as APIResponse);
  }
});

// Update bot
botRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const { displayName, description, config, status, isPublic } = req.body;
  
  try {
    const bot = await botForge.updateBot(param(req, 'id'), {
      displayName,
      description,
      config,
      status,
      isPublic,
    });
    
    res.json({
      success: true,
      data: bot
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update bot'
    } as APIResponse);
  }
});

// Terminate/delete bot
botRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await botSpawner.terminateBot(param(req, 'id'), req.user!.id);
    
    res.json({
      success: true,
      data: { message: 'Bot terminated' }
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to terminate bot'
    } as APIResponse);
  }
});

// ==================== Bot Communication ====================

// Send message to bot
botRouter.post('/:id/message', requireAuth, async (req: Request, res: Response) => {
  const { content, metadata } = req.body;
  
  if (!content) {
    res.status(400).json({
      success: false,
      error: 'Content is required'
    } as APIResponse);
    return;
  }
  
  try {
    const response = await botSpawner.sendToBot(
      param(req, 'id'),
      { content, metadata },
      req.user!.id
    );
    
    res.json({
      success: response.status === 'success',
      data: response
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    } as APIResponse);
  }
});

// Bot-to-bot message
botRouter.post('/:id/message/:targetId', requireAuth, async (req: Request, res: Response) => {
  const { content, metadata } = req.body;
  const id = param(req, 'id');
  const targetId = param(req, 'targetId');
  
  if (!content) {
    res.status(400).json({
      success: false,
      error: 'Content is required'
    } as APIResponse);
    return;
  }
  
  try {
    // Verify requester owns the source bot
    const bot = await botForge.getBot(id);
    if (!bot || bot.ownerId !== req.user!.id) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to send messages from this bot'
      } as APIResponse);
      return;
    }
    
    const response = await botSpawner.sendToBot(
      targetId,
      { content, metadata },
      id // From bot
    );
    
    res.json({
      success: response.status === 'success',
      data: response
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send bot-to-bot message'
    } as APIResponse);
  }
});

// Broadcast to team
botRouter.post('/teams/:teamId/broadcast', requireAuth, async (req: Request, res: Response) => {
  const { content, metadata } = req.body;
  const teamId = param(req, 'teamId');
  
  if (!content) {
    res.status(400).json({
      success: false,
      error: 'Content is required'
    } as APIResponse);
    return;
  }
  
  try {
    const responses = await botSpawner.broadcastToTeam(teamId, { content, metadata });
    
    const results = Array.from(responses.entries()).map(([botId, response]) => ({
      botId,
      ...response
    }));
    
    res.json({
      success: true,
      data: results
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to broadcast to team'
    } as APIResponse);
  }
});

// ==================== Task Management ====================

// Assign task to bot
botRouter.post('/:id/tasks', requireAuth, async (req: Request, res: Response) => {
  const { description, timeout, payload } = req.body;
  
  if (!description) {
    res.status(400).json({
      success: false,
      error: 'Task description is required'
    } as APIResponse);
    return;
  }
  
  try {
    const assignment = await botSpawner.assignTask(param(req, 'id'), {
      description,
      timeout,
      payload,
    });
    
    res.status(201).json({
      success: true,
      data: assignment
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign task'
    } as APIResponse);
  }
});

// Get task status
botRouter.get('/:id/tasks/:taskId', requireAuth, async (req: Request, res: Response) => {
  try {
    const task = await botSpawner.getTaskStatus(param(req, 'id'), param(req, 'taskId'));
    
    res.json({
      success: true,
      data: task
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get task status'
    } as APIResponse);
  }
});

// ==================== Status & Monitoring ====================

// Get active bots for user
botRouter.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const bots = await botSpawner.getActiveBots(req.user!.id);
    
    res.json({
      success: true,
      data: bots
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get active bots'
    } as APIResponse);
  }
});

// Get bot metrics
botRouter.get('/:id/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await botSpawner.getBotMetrics(param(req, 'id'));
    
    res.json({
      success: true,
      data: metrics
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics'
    } as APIResponse);
  }
});

// Pause bot
botRouter.post('/:id/pause', requireAuth, async (req: Request, res: Response) => {
  try {
    await botForge.updateBotStatus(param(req, 'id'), 'idle');
    
    res.json({
      success: true,
      data: { message: 'Bot paused' }
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to pause bot'
    } as APIResponse);
  }
});

// Resume bot
botRouter.post('/:id/resume', requireAuth, async (req: Request, res: Response) => {
  try {
    await botForge.updateBotStatus(param(req, 'id'), 'online');
    
    res.json({
      success: true,
      data: { message: 'Bot resumed' }
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to resume bot'
    } as APIResponse);
  }
});

// ==================== Bot Commands ====================

// List bot commands
botRouter.get('/:id/commands', async (req: Request, res: Response) => {
  try {
    const commands = await botForge.getCommands(param(req, 'id'));
    
    res.json({
      success: true,
      data: commands
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get commands'
    } as APIResponse);
  }
});

// Create bot command
botRouter.post('/:id/commands', requireAuth, async (req: Request, res: Response) => {
  const { name, description, type, triggers, handler, permissions } = req.body;
  
  if (!name || !type) {
    res.status(400).json({
      success: false,
      error: 'Name and type are required'
    } as APIResponse);
    return;
  }
  
  try {
    const command = await botForge.createCommand({
      botId: param(req, 'id'),
      name,
      description,
      type,
      triggers,
      requiredScopes: permissions,
    });
    
    res.status(201).json({
      success: true,
      data: command
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create command'
    } as APIResponse);
  }
});

// Invoke command
botRouter.post('/:id/interact', async (req: Request, res: Response) => {
  const { command, params, channelId, userId } = req.body;
  
  if (!command) {
    res.status(400).json({
      success: false,
      error: 'Command is required'
    } as APIResponse);
    return;
  }
  
  try {
    const result = await botForge.createInteraction({
      botId: param(req, 'id'),
      commandName: command as string,
      parameters: params || {},
      channelId,
      userId,
      type: 'command',
    });
    
    res.json({
      success: true,
      data: result
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invoke command'
    } as APIResponse);
  }
});

// ==================== Bot Messages ====================

// Get bot messages
botRouter.get('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const { limit, offset, unreadOnly } = req.query;
  
  try {
    const messages = await botForge.getBotMessages(param(req, 'id'), {
      limit: limit ? parseInt(limit as string) : 50,
      unreadOnly: unreadOnly === 'true',
    });
    
    res.json({
      success: true,
      data: messages
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get messages'
    } as APIResponse);
  }
});

// Mark messages as read
botRouter.post('/:id/messages/read', requireAuth, async (req: Request, res: Response) => {
  const { messageIds } = req.body;
  
  try {
    await botForge.markMessagesAsRead(param(req, 'id'), messageIds);
    
    res.json({
      success: true,
      data: { message: 'Messages marked as read' }
    } as APIResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    } as APIResponse);
  }
});
