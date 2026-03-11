import { db, query } from '../db/index.js';
import { 
  bots, botInstallations, botCommands, botInteractions, botDirectMessages,
  type Bot, type NewBot, type BotInstallation, type BotCommand, type BotInteraction
} from '../db/schema.bots.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { store } from './store.js';
import { authService } from '../auth/service.js';

// Bot events for WebSocket
export interface BotEvent {
  type: string;
  botId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Bot Forge Service
 * 
 * Manages the bot ecosystem:
 * - Bot registration and lifecycle
 * - Bot-to-bot communication
 * - Command handling
 * - Webhook delivery
 * - Interactions
 */
export class BotForgeService {
  private eventHandlers: Map<string, ((event: BotEvent) => void)[]> = new Map();
  private botClients: Map<string, any> = new Map(); // WebSocket connections
  
  // ==================== Bot Registration ====================
  
  async createBot(data: {
    name: string;
    displayName?: string;
    description?: string;
    ownerId: string;
    ownerType?: 'user' | 'ai' | 'server';
    type?: 'custom' | 'webhook' | 'integration' | 'ai_agent' | 'bridge';
    scopes?: string[];
    capabilities?: string[];
    config?: Record<string, unknown>;
    isPublic?: boolean;
    tags?: string[];
    category?: string;
  }): Promise<{ bot: Bot; apiKey: string }> {
    const id = uuidv4();
    
    // Create bot record
    const [bot] = await db.insert(bots).values({
      id,
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      ownerId: data.ownerId,
      ownerType: data.ownerType || 'user',
      type: data.type || 'custom',
      scopes: data.scopes || ['bot:read', 'bot:write', 'messages:read', 'messages:write'],
      capabilities: data.capabilities || ['respond_to_mentions', 'read_messages', 'send_messages'],
      config: data.config || {},
      isPublic: data.isPublic || false,
      tags: data.tags || [],
      category: data.category,
    }).returning();
    
    // Create API key for the bot
    const apiKeyResult = await authService.createAPIKey(
      data.ownerId, // Bot acts on behalf of owner initially
      `Bot: ${data.name}`,
      data.scopes || ['bot:read', 'bot:write'],
      365 // 1 year expiry
    );
    
    // Update bot with API key reference
    if (apiKeyResult.success && apiKeyResult.keyId) {
      await db.update(bots)
        .set({ apiKeyId: apiKeyResult.keyId })
        .where(eq(bots.id, id));
    }
    
    // Create user record for the bot (so it can be mentioned, etc.)
    await store.createUser({
      name: data.displayName || data.name,
      type: 'ai', // Bots are AI users
      metadata: {
        isBot: true,
        botId: id,
        botType: data.type || 'custom',
      },
    });
    
    return {
      bot,
      apiKey: apiKeyResult.key!,
    };
  }
  
  async getBot(id: string): Promise<Bot | undefined> {
    const [bot] = await db.select().from(bots).where(eq(bots.id, id));
    return bot;
  }
  
  async getBotByName(name: string): Promise<Bot | undefined> {
    const [bot] = await db.select().from(bots).where(eq(bots.name, name));
    return bot;
  }
  
  async listBots(options?: {
    ownerId?: string;
    category?: string;
    isPublic?: boolean;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ bots: Bot[]; total: number }> {
    let conditions = [];
    
    if (options?.ownerId) {
      conditions.push(eq(bots.ownerId, options.ownerId));
    }
    if (options?.category) {
      conditions.push(eq(bots.category, options.category));
    }
    if (options?.isPublic !== undefined) {
      conditions.push(eq(bots.isPublic, options.isPublic));
    }
    if (options?.status) {
      conditions.push(eq(bots.status, options.status));
    }
    
    const botList = await db.select()
      .from(bots)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bots.guildCount))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);
    
    // Get total count
    const [countResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(bots).where(conditions.length > 0 ? and(...conditions) : undefined);
    
    return {
      bots: botList,
      total: countResult?.count || 0,
    };
  }
  
  async updateBot(
    id: string,
    updates: Partial<NewBot>
  ): Promise<Bot | undefined> {
    const [bot] = await db.update(bots)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bots.id, id))
      .returning();
    return bot;
  }
  
  async deleteBot(id: string): Promise<boolean> {
    const result = await db.delete(bots).where(eq(bots.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // ==================== Bot Installation ====================
  
  async installBot(
    botId: string,
    serverId: string,
    installedBy: string,
    grantedScopes?: string[]
  ): Promise<BotInstallation> {
    // Get bot to check available scopes
    const bot = await this.getBot(botId);
    if (!bot) throw new Error('Bot not found');
    
    const [installation] = await db.insert(botInstallations).values({
      id: uuidv4(),
      botId,
      serverId,
      installedBy,
      grantedScopes: grantedScopes || bot.scopes,
    }).returning();
    
    // Update bot guild count
    await db.update(bots)
      .set({ 
        guildCount: sql`${bots.guildCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(bots.id, botId));
    
    return installation;
  }
  
  async uninstallBot(botId: string, serverId: string): Promise<boolean> {
    const result = await db.delete(botInstallations)
      .where(and(
        eq(botInstallations.botId, botId),
        eq(botInstallations.serverId, serverId)
      ));
    
    if (result.rowCount && result.rowCount > 0) {
      // Update bot guild count
      await db.update(bots)
        .set({ 
          guildCount: sql`${bots.guildCount} - 1`,
          updatedAt: new Date()
        })
        .where(eq(bots.id, botId));
    }
    
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async getBotInstallation(
    botId: string,
    serverId: string
  ): Promise<BotInstallation | undefined> {
    const [installation] = await db.select()
      .from(botInstallations)
      .where(and(
        eq(botInstallations.botId, botId),
        eq(botInstallations.serverId, serverId)
      ));
    return installation;
  }
  
  // ==================== Bot Commands ====================
  
  async createCommand(data: {
    botId: string;
    name: string;
    description: string;
    type?: 'slash' | 'mention' | 'message' | 'reaction' | 'event';
    triggers?: string[];
    parameters?: Array<{
      name: string;
      description: string;
      type: string;
      required: boolean;
      default?: unknown;
    }>;
    requiredScopes?: string[];
    rateLimitPerMinute?: number;
  }): Promise<BotCommand> {
    const [command] = await db.insert(botCommands).values({
      id: uuidv4(),
      botId: data.botId,
      name: data.name,
      description: data.description,
      type: data.type || 'slash',
      triggers: data.triggers || [`/${data.name}`],
      parameters: data.parameters || [],
      requiredScopes: data.requiredScopes || [],
      rateLimitPerMinute: data.rateLimitPerMinute || 10,
    }).returning();
    
    // Update bot command count
    await db.update(bots)
      .set({ 
        commandCount: sql`${bots.commandCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(bots.id, data.botId));
    
    return command;
  }
  
  async getCommands(botId: string): Promise<BotCommand[]> {
    return db.select()
      .from(botCommands)
      .where(and(
        eq(botCommands.botId, botId),
        eq(botCommands.isEnabled, true)
      ))
      .orderBy(botCommands.name);
  }
  
  async findCommandByTrigger(
    botId: string,
    trigger: string
  ): Promise<BotCommand | undefined> {
    const commands = await this.getCommands(botId);
    return commands.find(cmd => 
      cmd.triggers?.some(t => 
        t.toLowerCase() === trigger.toLowerCase()
      )
    );
  }
  
  // ==================== Interactions ====================
  
  async createInteraction(data: {
    userId?: string;
    botId: string;
    serverId?: string;
    channelId?: string;
    type: string;
    commandName?: string;
    parameters?: Record<string, unknown>;
    messageId?: string;
    context?: Record<string, unknown>;
  }): Promise<BotInteraction> {
    const [interaction] = await db.insert(botInteractions).values({
      id: uuidv4(),
      userId: data.userId,
      botId: data.botId,
      serverId: data.serverId,
      channelId: data.channelId,
      type: data.type,
      commandName: data.commandName,
      parameters: data.parameters || {},
      messageId: data.messageId,
      context: data.context || {},
      status: 'pending',
    }).returning();
    
    // Update bot stats
    await db.update(bots)
      .set({ 
        messageCount: sql`${bots.messageCount} + 1`,
        lastActiveAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(bots.id, data.botId));
    
    // Notify bot via WebSocket
    this.emitToBot(data.botId, {
      type: 'interaction.created',
      botId: data.botId,
      data: { interaction },
      timestamp: new Date(),
    });
    
    return interaction;
  }
  
  async updateInteractionResponse(
    interactionId: string,
    response: {
      responseType: string;
      responseContent?: string;
      status?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await db.update(botInteractions)
      .set({
        responseType: response.responseType,
        responseContent: response.responseContent,
        status: response.status || 'completed',
        errorMessage: response.errorMessage,
        completedAt: new Date(),
      })
      .where(eq(botInteractions.id, interactionId));
  }
  
  // ==================== Bot-to-Bot Communication ====================
  
  async sendBotMessage(
    fromBotId: string,
    toBotId: string,
    content: string,
    messageType: string = 'message',
    protocol: string = 'janus',
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Verify both bots exist
    const [fromBot, toBot] = await Promise.all([
      this.getBot(fromBotId),
      this.getBot(toBotId),
    ]);
    
    if (!fromBot) return { success: false, error: 'Sender bot not found' };
    if (!toBot) return { success: false, error: 'Recipient bot not found' };
    
    // Check if recipient accepts messages
    if (toBot.status === 'offline' || toBot.status === 'error') {
      return { success: false, error: 'Recipient bot is offline' };
    }
    
    // Store message
    const [message] = await db.insert(botDirectMessages).values({
      id: uuidv4(),
      fromBotId,
      toBotId,
      content,
      messageType,
      protocol,
      metadata: metadata || {},
    }).returning();
    
    // Notify recipient bot
    this.emitToBot(toBotId, {
      type: 'bot.message.received',
      botId: toBotId,
      data: {
        messageId: message.id,
        fromBotId,
        content,
        messageType,
        protocol,
        metadata,
      },
      timestamp: new Date(),
    });
    
    return { success: true, messageId: message.id };
  }
  
  async getBotMessages(
    botId: string,
    options?: {
      direction?: 'in' | 'out' | 'both';
      unreadOnly?: boolean;
      limit?: number;
    }
  ): Promise<any[]> {
    const conditions = [];
    
    if (options?.direction === 'in') {
      conditions.push(eq(botDirectMessages.toBotId, botId));
    } else if (options?.direction === 'out') {
      conditions.push(eq(botDirectMessages.fromBotId, botId));
    } else {
      conditions.push(sql`${botDirectMessages.toBotId} = ${botId} OR ${botDirectMessages.fromBotId} = ${botId}`);
    }
    
    if (options?.unreadOnly) {
      conditions.push(eq(botDirectMessages.isRead, false));
    }
    
    return db.select()
      .from(botDirectMessages)
      .where(and(...conditions))
      .orderBy(desc(botDirectMessages.createdAt))
      .limit(options?.limit || 50);
  }
  
  async markMessagesAsRead(botId: string, messageIds?: string[]): Promise<void> {
    if (messageIds && messageIds.length > 0) {
      await db.update(botDirectMessages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          inArray(botDirectMessages.id, messageIds),
          eq(botDirectMessages.toBotId, botId)
        ));
    } else {
      // Mark all as read
      await db.update(botDirectMessages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(botDirectMessages.toBotId, botId),
          eq(botDirectMessages.isRead, false)
        ));
    }
  }
  
  // ==================== WebSocket Event Handling ====================
  
  registerBotClient(botId: string, socket: any): void {
    this.botClients.set(botId, socket);
    
    // Update status to online
    this.updateBotStatus(botId, 'online');
    
    // Send any pending messages
    this.deliverPendingMessages(botId);
  }
  
  unregisterBotClient(botId: string): void {
    this.botClients.delete(botId);
    this.updateBotStatus(botId, 'offline');
  }
  
  private emitToBot(botId: string, event: BotEvent): void {
    const socket = this.botClients.get(botId);
    if (socket) {
      socket.emit('bot:event', event);
    }
  }
  
  private async deliverPendingMessages(botId: string): Promise<void> {
    const pending = await this.getBotMessages(botId, { 
      direction: 'in', 
      unreadOnly: true,
      limit: 100 
    });
    
    for (const msg of pending) {
      this.emitToBot(botId, {
        type: 'bot.message.pending',
        botId,
        data: { message: msg },
        timestamp: new Date(),
      });
    }
  }
  
  async updateBotStatus(
    botId: string, 
    status: 'online' | 'offline' | 'idle' | 'dnd' | 'error'
  ): Promise<void> {
    await db.update(bots)
      .set({ status, updatedAt: new Date() })
      .where(eq(bots.id, botId));
  }
  
  // ==================== Event Subscriptions ====================
  
  on(event: string, handler: (event: BotEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }
  
  emit(event: string, data: BotEvent): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in bot event handler: ${error}`);
      }
    }
  }
}

// Singleton instance
export const botForge = new BotForgeService();
