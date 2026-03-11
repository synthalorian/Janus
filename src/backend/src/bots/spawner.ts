import { v4 as uuidv4 } from 'uuid';
import { BotForgeService } from './service.js';
import { getTemplate, listTemplates, type BotTemplate } from './templates.js';
import { db } from '../db/index.js';
import { bots, botTeams, botTeamMembers } from '../db/schema.bots.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

/**
 * Autonomous Bot Spawner
 * 
 * Allows AI agents to create, manage, and communicate with bots
 * without human intervention.
 */
export class BotSpawner {
  private botForge: BotForgeService;
  private activeBots: Map<string, ActiveBotInstance> = new Map();
  private botQueue: BotSpawnRequest[] = [];
  private maxConcurrentBots = 10;

  constructor(botForge: BotForgeService) {
    this.botForge = botForge;
    this.startBotProcessor();
  }

  // ==================== Spawning ====================

  /**
   * Spawn a bot from a template
   */
  async spawnBot(request: BotSpawnRequest): Promise<SpawnedBot> {
    const template = getTemplate(request.template);
    if (!template) {
      throw new Error(`Unknown template: ${request.template}`);
    }

    // Validate requester permissions
    await this.validateSpawnPermission(request.ownerId, request.ownerType);

    // Check concurrent limit
    if (this.activeBots.size >= this.maxConcurrentBots) {
      // Queue the request
      this.botQueue.push(request);
      return {
        status: 'queued',
        queuePosition: this.botQueue.length,
        message: 'Bot queued due to concurrent limit',
      };
    }

    // Merge template config with custom config
    const config = {
      ...template.defaultConfig,
      ...request.config,
    };

    // Create the bot
    const { bot, apiKey } = await this.botForge.createBot({
      name: request.name || `${template.name}-${Date.now()}`,
      displayName: request.displayName || template.name,
      description: request.description || template.description,
      ownerId: request.ownerId,
      ownerType: request.ownerType || 'ai',
      type: template.type as any,
      scopes: template.scopes,
      capabilities: template.capabilities,
      config,
      isPublic: false,
      tags: [template.category],
      category: template.category,
    });

    // Create active instance
    const instance: ActiveBotInstance = {
      id: uuidv4(),
      botId: bot.id,
      template: request.template,
      ownerId: request.ownerId,
      apiKey,
      status: 'starting',
      createdAt: new Date(),
      tasks: [],
      messages: [],
    };

    this.activeBots.set(bot.id, instance);

    // Start the bot if autoStart is enabled
    if (template.autoStart) {
      await this.startBotInstance(instance, template);
    }

    return {
      status: 'spawned',
      botId: bot.id,
      apiKey,
      template: request.template,
      message: `Bot ${bot.name} spawned successfully`,
    };
  }

  /**
   * Spawn multiple bots as a team
   */
  async spawnTeam(request: TeamSpawnRequest): Promise<SpawnedTeam> {
    const teamId = uuidv4();
    const spawnedBots: SpawnedBot[] = [];

    // Create team record
    await db.insert(botTeams).values({
      id: teamId,
      name: request.name,
      description: request.description,
      ownerId: request.ownerId,
      config: request.config || {},
      persistent: request.persistent || false,
    });

    // Spawn each bot
    for (const botSpec of request.bots) {
      const template = getTemplate(botSpec.template);
      if (!template) continue;

      const spawned = await this.spawnBot({
        template: botSpec.template,
        name: botSpec.name || `${template.name}-${teamId.slice(0, 8)}`,
        displayName: botSpec.name,
        ownerId: request.ownerId,
        ownerType: 'ai',
        config: botSpec.config,
        teamId,
      });

      if (spawned.status === 'spawned') {
        spawnedBots.push(spawned);

        // Add to team
        await db.insert(botTeamMembers).values({
          id: uuidv4(),
          teamId,
          botId: spawned.botId!,
          role: botSpec.role || 'member',
        });
      }
    }

    return {
      teamId,
      bots: spawnedBots,
      message: `Team ${request.name} created with ${spawnedBots.length} bots`,
    };
  }

  /**
   * Terminate a spawned bot
   */
  async terminateBot(botId: string, requesterId: string): Promise<void> {
    const instance = this.activeBots.get(botId);
    if (!instance) {
      throw new Error('Bot not found or not active');
    }

    // Validate ownership
    if (instance.ownerId !== requesterId) {
      // Check if requester has bot:manage permission
      const hasPermission = await this.checkManagePermission(requesterId);
      if (!hasPermission) {
        throw new Error('Not authorized to terminate this bot');
      }
    }

    // Stop the bot
    await this.stopBotInstance(instance);

    // Update status
    await db.update(bots)
      .set({ status: 'offline' })
      .where(eq(bots.id, botId));

    // Remove from active
    this.activeBots.delete(botId);

    // Process queue if any
    this.processQueue();
  }

  // ==================== Communication ====================

  /**
   * Send a message to a bot
   */
  async sendToBot(
    botId: string,
    message: BotMessage,
    fromId: string
  ): Promise<BotResponse> {
    const instance = this.activeBots.get(botId);
    if (!instance || instance.status !== 'active') {
      throw new Error('Bot not available');
    }

    // Add to bot's message queue
    instance.messages.push({
      id: uuidv4(),
      from: fromId,
      content: message.content,
      metadata: message.metadata,
      timestamp: new Date(),
    });

    // Process message (this would integrate with AI/LLM)
    const response = await this.processBotMessage(instance, message);

    return response;
  }

  /**
   * Broadcast message to all bots in a team
   */
  async broadcastToTeam(
    teamId: string,
    message: BotMessage
  ): Promise<Map<string, BotResponse>> {
    const teamMembers = await db.select()
      .from(botTeamMembers)
      .where(eq(botTeamMembers.teamId, teamId));

    const responses = new Map<string, BotResponse>();

    for (const member of teamMembers) {
      try {
        const response = await this.sendToBot(
          member.botId,
          message,
          'team-broadcast'
        );
        responses.set(member.botId, response);
      } catch (error) {
        responses.set(member.botId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return responses;
  }

  // ==================== Task Management ====================

  /**
   * Assign a task to a bot
   */
  async assignTask(
    botId: string,
    task: BotTask
  ): Promise<TaskAssignment> {
    const instance = this.activeBots.get(botId);
    if (!instance) {
      throw new Error('Bot not found');
    }

    const template = getTemplate(instance.template);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check task limits
    if (instance.tasks.length >= template.limits.maxTasks) {
      throw new Error(`Bot has reached max tasks (${template.limits.maxTasks})`);
    }

    const taskId = uuidv4();
    const assignment: TaskAssignment = {
      taskId,
      botId,
      task: task.description,
      status: 'assigned',
      assignedAt: new Date(),
      timeout: task.timeout || template.limits.timeout,
    };

    instance.tasks.push(assignment);

    // Start task execution (async)
    this.executeTask(instance, assignment, task, template)
      .catch(err => console.error(`Task ${taskId} failed:`, err));

    return assignment;
  }

  /**
   * Get task status
   */
  async getTaskStatus(botId: string, taskId: string): Promise<TaskAssignment> {
    const instance = this.activeBots.get(botId);
    if (!instance) {
      throw new Error('Bot not found');
    }

    const task = instance.tasks.find(t => t.taskId === taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  // ==================== Status & Monitoring ====================

  /**
   * Get active bots for an owner
   */
  async getActiveBots(ownerId: string): Promise<ActiveBotInfo[]> {
    const bots: ActiveBotInfo[] = [];
    
    for (const [botId, instance] of this.activeBots) {
      if (instance.ownerId === ownerId) {
        bots.push({
          botId,
          template: instance.template,
          status: instance.status,
          taskCount: instance.tasks.length,
          messageCount: instance.messages.length,
          createdAt: instance.createdAt,
        });
      }
    }

    return bots;
  }

  /**
   * Get bot metrics
   */
  async getBotMetrics(botId: string): Promise<BotMetrics> {
    const instance = this.activeBots.get(botId);
    if (!instance) {
      throw new Error('Bot not found');
    }

    return {
      botId,
      status: instance.status,
      uptime: Date.now() - instance.createdAt.getTime(),
      tasksCompleted: instance.tasks.filter(t => t.status === 'completed').length,
      tasksFailed: instance.tasks.filter(t => t.status === 'failed').length,
      messagesReceived: instance.messages.length,
      lastActivity: instance.messages.length > 0 
        ? instance.messages[instance.messages.length - 1].timestamp 
        : instance.createdAt,
    };
  }

  // ==================== Private Methods ====================

  private async validateSpawnPermission(
    ownerId: string,
    ownerType: string
  ): Promise<void> {
    // Check if owner has permission to spawn bots
    // This integrates with the oversight system
    const botCount = Array.from(this.activeBots.values())
      .filter(b => b.ownerId === ownerId).length;

    if (botCount >= 5) { // Max 5 bots per owner
      throw new Error('Maximum bot limit reached (5)');
    }
  }

  private async checkManagePermission(requesterId: string): Promise<boolean> {
    // Check oversight/permission system
    // For now, allow all
    return true;
  }

  private async startBotInstance(
    instance: ActiveBotInstance,
    template: BotTemplate
  ): Promise<void> {
    instance.status = 'active';
    
    await db.update(bots)
      .set({ status: 'online' })
      .where(eq(bots.id, instance.botId));

    // Bot is now ready to receive messages and tasks
    console.log(`Bot ${instance.botId} (${template.name}) started`);
  }

  private async stopBotInstance(instance: ActiveBotInstance): Promise<void> {
    instance.status = 'stopped';
    
    // Cancel pending tasks
    for (const task of instance.tasks) {
      if (task.status === 'assigned' || task.status === 'running') {
        task.status = 'cancelled';
      }
    }
  }

  private async processBotMessage(
    instance: ActiveBotInstance,
    message: BotMessage
  ): Promise<BotResponse> {
    // This would integrate with AI/LLM to process the message
    // For now, return a placeholder
    return {
      status: 'success',
      response: `Bot ${instance.botId} received: ${message.content}`,
      metadata: {
        processedAt: new Date(),
      },
    };
  }

  private async executeTask(
    instance: ActiveBotInstance,
    assignment: TaskAssignment,
    task: BotTask,
    template: BotTemplate
  ): Promise<void> {
    assignment.status = 'running';
    assignment.startedAt = new Date();

    try {
      // This would integrate with AI/LLM to execute the task
      // For now, simulate completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      assignment.status = 'completed';
      assignment.completedAt = new Date();
      assignment.result = task.description;
    } catch (error) {
      assignment.status = 'failed';
      assignment.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private startBotProcessor(): void {
    // Process queued bots every 5 seconds
    setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private processQueue(): void {
    if (this.botQueue.length === 0) return;
    if (this.activeBots.size >= this.maxConcurrentBots) return;

    const request = this.botQueue.shift();
    if (request) {
      this.spawnBot(request).catch(err => {
        console.error('Failed to spawn queued bot:', err);
      });
    }
  }
}

// ==================== Types ====================

interface BotSpawnRequest {
  template: string;
  name?: string;
  displayName?: string;
  description?: string;
  ownerId: string;
  ownerType?: 'user' | 'ai' | 'server';
  config?: Record<string, unknown>;
  teamId?: string;
}

interface TeamSpawnRequest {
  name: string;
  description?: string;
  ownerId: string;
  bots: Array<{
    template: string;
    name?: string;
    role?: string;
    config?: Record<string, unknown>;
  }>;
  config?: Record<string, unknown>;
  persistent?: boolean;
}

interface SpawnedBot {
  status: 'spawned' | 'queued' | 'error';
  botId?: string;
  apiKey?: string;
  template?: string;
  queuePosition?: number;
  message?: string;
  error?: string;
}

interface SpawnedTeam {
  teamId: string;
  bots: SpawnedBot[];
  message: string;
}

interface ActiveBotInstance {
  id: string;
  botId: string;
  template: string;
  ownerId: string;
  apiKey: string;
  status: 'starting' | 'active' | 'stopped' | 'error';
  createdAt: Date;
  tasks: TaskAssignment[];
  messages: BotMessageRecord[];
}

interface BotMessage {
  content: string;
  metadata?: Record<string, unknown>;
}

interface BotMessageRecord extends BotMessage {
  id: string;
  from: string;
  timestamp: Date;
}

interface BotResponse {
  status: 'success' | 'error';
  response?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface BotTask {
  description: string;
  timeout?: number;
  payload?: Record<string, unknown>;
}

interface TaskAssignment {
  taskId: string;
  botId: string;
  task: string;
  status: 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeout: number;
  result?: string;
  error?: string;
}

interface ActiveBotInfo {
  botId: string;
  template: string;
  status: string;
  taskCount: number;
  messageCount: number;
  createdAt: Date;
}

interface BotMetrics {
  botId: string;
  status: string;
  uptime: number;
  tasksCompleted: number;
  tasksFailed: number;
  messagesReceived: number;
  lastActivity: Date;
}

export const botSpawner = new BotSpawner(new BotForgeService());
