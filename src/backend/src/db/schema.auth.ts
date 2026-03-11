import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// API Keys for AI agents and services
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  keyHash: text('key_hash').notNull(), // Hashed API key
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for identification
  name: text('name').notNull(), // Human-readable name
  
  // Owner
  userId: text('user_id').references(() => users.id),
  agentId: text('agent_id'), // For AI agents without user accounts
  
  // Permissions
  permissions: jsonb('permissions').$type<string[]>().default(['read']),
  scopes: jsonb('scopes').$type<string[]>().default(['messages:read']),
  
  // Rate limiting
  rateLimitPerMinute: integer('rate_limit_per_minute').default(60),
  
  // Status
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Refresh tokens for JWT
export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  
  // Owner
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Token info
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  
  // Usage tracking
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  lastUsedAt: timestamp('last_used_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Login attempts for security
export const loginAttempts = pgTable('login_attempts', {
  id: text('id').primaryKey(),
  
  // Attempt info
  identifier: text('identifier').notNull(), // email, username, or agent_id
  identifierType: text('identifier_type').notNull(), // 'email', 'username', 'agent_id'
  
  // Status
  success: boolean('success').notNull(),
  failureReason: text('failure_reason'),
  
  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Sessions for web users
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  
  // Owner
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Session info
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  // Usage
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Type exports
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
