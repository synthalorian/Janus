import { pgTable, text, timestamp, integer, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Bot registry - bots are special AI users
export const bots = pgTable('bots', {
  id: text('id').primaryKey(),
  
  // Identity
  name: text('name').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  avatar: text('avatar_url'), // URL or base64
  
  // Owner
  ownerId: text('owner_id').notNull().references(() => users.id),
  ownerType: varchar('owner_type', { length: 20 }).notNull().default('user'), // 'user' | 'ai' | 'server'
  
  // Bot type
  type: varchar('bot_type', { length: 50 }).notNull().default('custom'), 
  // 'custom', 'webhook', 'integration', 'ai_agent', 'bridge'
  
  // Authentication
  apiKeyId: text('api_key_id').references(() => apiKeys.id),
  
  // Permissions (OAuth-like scopes)
  scopes: jsonb('scopes').$type<string[]>().default([
    'bot:read',
    'bot:write',
    'messages:read',
    'messages:write'
  ]),
  
  // Capabilities
  capabilities: jsonb('capabilities').$type<string[]>().default([
    'respond_to_mentions',
    'read_messages',
    'send_messages'
  ]),
  
  // Configuration
  config: jsonb('config').$type<Record<string, unknown>>().default({
    // Webhook URL for webhook bots
    // Command prefix for command bots
    // AI model for AI agent bots
    // etc.
  }),
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('offline'),
  // 'online', 'offline', 'idle', 'dnd', 'error'
  
  isPublic: boolean('is_public').default(false), // Can other servers add this bot?
  isVerified: boolean('is_verified').default(false), // Official verification
  
  // Stats
  guildCount: integer('guild_count').default(0),
  commandCount: integer('command_count').default(0),
  messageCount: integer('message_count').default(0),
  
  // Metadata
  tags: jsonb('tags').$type<string[]>().default([]),
  category: varchar('category', { length: 50 }), // 'productivity', 'fun', 'dev', 'ai'
  
  // Timestamps
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Bot installations - which servers have which bots
export const botInstallations = pgTable('bot_installations', {
  id: text('id').primaryKey(),
  
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  serverId: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  
  // Installation-specific config
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  
  // Permissions in this server
  grantedScopes: jsonb('granted_scopes').$type<string[]>().default([]),
  
  // Status in this server
  isActive: boolean('is_active').default(true),
  disabledAt: timestamp('disabled_at'),
  disabledReason: text('disabled_reason'),
  
  // Who added the bot
  installedBy: text('installed_by').references(() => users.id),
  installedAt: timestamp('installed_at').notNull().defaultNow(),
  
  // Stats for this installation
  messageCount: integer('message_count').default(0),
  commandCount: integer('command_count').default(0),
});

// Bot commands - slash commands, mention commands, etc.
export const botCommands = pgTable('bot_commands', {
  id: text('id').primaryKey(),
  
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  
  // Command definition
  name: text('name').notNull(),
  description: text('description').notNull(),
  
  // Type
  type: varchar('type', { length: 20 }).notNull().default('slash'),
  // 'slash', 'mention', 'message', 'reaction', 'event'
  
  // Triggers
  triggers: jsonb('triggers').$type<string[]>().default([]),
  // For mention: ['@botname']
  // For slash: ['/command']
  // For message: ['!ping', '?help']
  
  // Arguments/parameters
  parameters: jsonb('parameters').$type<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'user' | 'channel';
    required: boolean;
    default?: unknown;
  }[]>().default([]),
  
  // Permission requirements
  requiredScopes: jsonb('required_scopes').$type<string[]>().default([]),
  requiredRoles: jsonb('required_roles').$type<string[]>().default([]),
  
  // Rate limiting
  rateLimitPerMinute: integer('rate_limit_per_minute').default(10),
  rateLimitPerUser: integer('rate_limit_per_user').default(5),
  
  // Status
  isEnabled: boolean('is_enabled').default(true),
  
  // Stats
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Bot interactions - command invocations, button clicks, etc.
export const botInteractions = pgTable('bot_interactions', {
  id: text('id').primaryKey(),
  
  // Who/what triggered
  userId: text('user_id').references(() => users.id),
  botId: text('bot_id').notNull().references(() => bots.id),
  serverId: text('server_id').references(() => servers.id),
  channelId: text('channel_id').references(() => channels.id),
  
  // What happened
  type: varchar('type', { length: 30 }).notNull(),
  // 'command', 'button_click', 'select_menu', 'modal_submit', 
  // 'mention', 'message', 'reaction', 'event'
  
  // Details
  commandName: text('command_name'),
  parameters: jsonb('parameters').$type<Record<string, unknown>>().default({}),
  
  // Context
  messageId: text('message_id'),
  context: jsonb('context').$type<Record<string, unknown>>().default({}),
  
  // Response
  responseType: varchar('response_type', { length: 20 }),
  // 'message', 'embed', 'modal', 'defer', 'error'
  responseContent: text('response_content'),
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'),
  // 'pending', 'processing', 'completed', 'failed', 'timeout'
  
  errorMessage: text('error_message'),
  
  // Timing
  processedAt: timestamp('processed_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Bot-to-bot communication - direct messages between bots
export const botDirectMessages = pgTable('bot_direct_messages', {
  id: text('id').primaryKey(),
  
  // Participants
  fromBotId: text('from_bot_id').notNull().references(() => bots.id),
  toBotId: text('to_bot_id').notNull().references(() => bots.id),
  
  // Message
  content: text('content').notNull(),
  
  // Type of communication
  messageType: varchar('message_type', { length: 30 }).default('message'),
  // 'message', 'command', 'query', 'response', 'event', 'handshake'
  
  // Protocol info
  protocol: varchar('protocol', { length: 30 }).default('janus'),
  // 'janus', 'matrix', 'activitypub', 'custom'
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  
  // Read status
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Bot webhooks - for external integrations
export const botWebhooks = pgTable('bot_webhooks', {
  id: text('id').primaryKey(),
  
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  
  // Webhook config
  url: text('url').notNull(),
  secret: text('secret'), // For HMAC verification
  
  // Events to send
  events: jsonb('events').$type<string[]>().default([
    'message.created',
    'message.deleted',
    'interaction.created'
  ]),
  
  // Status
  isActive: boolean('is_active').default(true),
  lastSuccessAt: timestamp('last_success_at'),
  lastFailureAt: timestamp('last_failure_at'),
  failureCount: integer('failure_count').default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const botsRelations = relations(bots, ({ one, many }) => ({
  owner: one(users, {
    fields: [bots.ownerId],
    references: [users.id],
  }),
  installations: many(botInstallations),
  commands: many(botCommands),
  interactions: many(botInteractions),
  sentMessages: many(botDirectMessages, { relationName: 'from_bot' }),
  receivedMessages: many(botDirectMessages, { relationName: 'to_bot' }),
}));

export const botInstallationsRelations = relations(botInstallations, ({ one }) => ({
  bot: one(bots, {
    fields: [botInstallations.botId],
    references: [bots.id],
  }),
  server: one(servers, {
    fields: [botInstallations.serverId],
    references: [servers.id],
  }),
}));

export const botCommandsRelations = relations(botCommands, ({ one }) => ({
  bot: one(bots, {
    fields: [botCommands.botId],
    references: [bots.id],
  }),
}));

export const botInteractionsRelations = relations(botInteractions, ({ one }) => ({
  bot: one(bots, {
    fields: [botInteractions.botId],
    references: [bots.id],
  }),
  user: one(users, {
    fields: [botInteractions.userId],
    references: [users.id],
  }),
}));

// Type exports
export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;
export type BotInstallation = typeof botInstallations.$inferSelect;
export type NewBotInstallation = typeof botInstallations.$inferInsert;
export type BotCommand = typeof botCommands.$inferSelect;
export type NewBotCommand = typeof botCommands.$inferInsert;
export type BotInteraction = typeof botInteractions.$inferSelect;
export type NewBotInteraction = typeof botInteractions.$inferInsert;
export type BotDirectMessage = typeof botDirectMessages.$inferSelect;
export type NewBotDirectMessage = typeof botDirectMessages.$inferInsert;
export type BotWebhook = typeof botWebhooks.$inferSelect;
export type NewBotWebhook = typeof botWebhooks.$inferInsert;
