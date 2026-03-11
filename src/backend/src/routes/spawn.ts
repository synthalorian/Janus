import { Router, Request, Response } from 'express';
import { botSpawner, BOT_TEMPLATES } from '../bots/spawner.js';
import { authMiddleware, requirePermission } from '../auth/middleware.js';

export const spawnRouter = Router();

// All routes require authentication
spawnRouter.use(authMiddleware);

/**
 * List available bot templates
 */
spawnRouter.get('/templates', (_req: Request, res: Response) => {
  const templates = Object.entries(BOT_TEMPLATES).map(([key, template]) => ({
    id: key,
    name: template.name,
    description: template.description,
    capabilities: template.capabilities,
    category: template.category,
  }));

  res.json({ success: true, templates });
});

/**
 * Spawn a new bot autonomously
 */
spawnRouter.post('/spawn', requirePermission('bot:spawn'), async (req: Request, res: Response) => {
  try {
    const { template, name, displayName, purpose, capabilities, config, serverId, autoStart } = req.body;
    const ownerId = req.user!.id;

    // Validate template
    if (template && !BOT_TEMPLATES[template as keyof typeof BOT_TEMPLATES]) {
      res.status(400).json({
        success: false,
        error: `Invalid template: ${template}. Available: ${Object.keys(BOT_TEMPLATES).join(', ')}`,
      });
      return;
    }

    // Check if can spawn more
    const spawnCheck = await botSpawner.canSpawnMore(ownerId);
    if (!spawnCheck.allowed) {
      res.status(403).json({
        success: false,
        error: spawnCheck.reason,
        current: spawnCheck.current,
        max: spawnCheck.max,
      });
      return;
    }

    // Spawn the bot
    const bot = await botSpawner.spawnBot({
      template: template || 'custom',
      name: name || `Bot-${Date.now()}`,
      displayName,
      purpose,
      capabilities,
      config,
      ownerId,
      serverId,
      autoStart,
    });

    res.status(201).json({
      success: true,
      bot,
      message: 'Bot spawned successfully. Save the API key - it will not be shown again.',
    });
  } catch (error) {
    console.error('Spawn error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn bot',
    });
  }
});

/**
 * Spawn a team of bots
 */
spawnRouter.post('/team', requirePermission('bot:spawn'), async (req: Request, res: Response) => {
  try {
    const { name, bots: botSpecs, serverId } = req.body;
    const ownerId = req.user!.id;

    // Check if can spawn all bots
    const spawnCheck = await botSpawner.canSpawnMore(ownerId);
    if (!spawnCheck.allowed || spawnCheck.current + botSpecs.length > spawnCheck.max) {
      res.status(403).json({
        success: false,
        error: `Cannot spawn ${botSpecs.length} bots. Limit: ${spawnCheck.max}, Current: ${spawnCheck.current}`,
      });
      return;
    }

    // Spawn all bots
    const spawnedBots = await botSpawner.spawnBotTeam(
      botSpecs.map(spec => ({
        ...spec,
        ownerId,
        serverId,
      }))
    );

    res.status(201).json({
      success: true,
      teamId: spawnedBots.teamId,
      bots: spawnedBots.bots,
      message: `Spawned ${spawnedBots.bots.length} bots. Save all API keys.`,
    });
  } catch (error) {
    console.error('Team spawn error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spawn bot team',
    });
  }
});

/**
 * Get bot status
 */
spawnRouter.get('/:botId/status', async (req: Request, res: Response) => {
  try {
    const status = await botSpawner.getBotStatus(req.params.botId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bot not found',
    });
  }
});

/**
 * List bots owned by current AI agent
 */
spawnRouter.get('/owned', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const bots = await botSpawner.listOwnedBots(ownerId);
    res.json({ success: true, bots, count: bots.length });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list bots',
    });
  }
});

/**
 * Pause a bot
 */
spawnRouter.post('/:botId/pause', async (req: Request, res: Response) => {
  try {
    await botSpawner.updateBotStatus(req.params.botId, 'idle');
    res.json({ success: true, message: 'Bot paused' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause bot',
    });
  }
});

/**
 * Resume a bot
 */
spawnRouter.post('/:botId/resume', async (req: Request, res: Response) => {
  try {
    await botSpawner.updateBotStatus(req.params.botId, 'online');
    res.json({ success: true, message: 'Bot resumed' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume bot',
    });
  }
});

/**
 * Terminate a bot
 */
spawnRouter.delete('/:botId', async (req: Request, res: Response) => {
  try {
    await botSpawner.terminateBot(req.params.botId);
    res.json({ success: true, message: 'Bot terminated' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to terminate bot',
    });
  }
});

/**
 * Check spawn limits
 */
spawnRouter.get('/limits', async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const limits = await botSpawner.canSpawnMore(ownerId);
    res.json({ success: true, ...limits });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check limits',
    });
  }
});
