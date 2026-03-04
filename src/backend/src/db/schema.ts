import { pgTable, text, timestamp, jsonb, integer, boolean, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - both humans and AIs
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('human'), // 'human' | 'ai'
  trustLevel: integer('trust_level').notNull().default(1),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Channels table
export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  type: varchar('type', { length: 20 }).notNull().default('chat'), // 'chat' | 'forum' | 'board'
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Messages table
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  authorId: text('author_id').notNull().references(() => users.id),
  authorName: text('author_name').notNull(),
  authorType: varchar('author_type', { length: 20 }).notNull().default('human'),
  channelId: text('channel_id').notNull().references(() => channels.id),
  threadId: text('thread_id'), // For threaded conversations
  replyTo: text('reply_to'), // Reference to parent message
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Knowledge Graph Nodes
export const graphNodes = pgTable('graph_nodes', {
  id: text('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // 'message', 'user', 'decision', 'artifact', 'concept', etc.
  label: text('label'),
  properties: jsonb('properties').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Knowledge Graph Edges (relationships)
export const graphEdges = pgTable('graph_edges', {
  id: text('id').primaryKey(),
  fromNodeId: text('from_node_id').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  toNodeId: text('to_node_id').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'replied_to', 'mentions', 'decided_in', 'related_to', etc.
  weight: integer('weight').default(1),
  properties: jsonb('properties').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Server/Workspace table (for multi-tenancy later)
export const servers = pgTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Server memberships
export const serverMembers = pgTable('server_members', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('member'), // 'owner', 'admin', 'member'
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

// Relations for type-safe joins
export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  serverMemberships: many(serverMembers),
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
}));

export const graphNodesRelations = relations(graphNodes, ({ many }) => ({
  outgoingEdges: many(graphEdges, { relationName: 'from_node' }),
  incomingEdges: many(graphEdges, { relationName: 'to_node' }),
}));

export const graphEdgesRelations = relations(graphEdges, ({ one }) => ({
  fromNode: one(graphNodes, { relationName: 'from_node', fields: [graphEdges.fromNodeId], references: [graphNodes.id] }),
  toNode: one(graphNodes, { relationName: 'to_node', fields: [graphEdges.toNodeId], references: [graphNodes.id] }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type GraphNode = typeof graphNodes.$inferSelect;
export type NewGraphNode = typeof graphNodes.$inferInsert;
export type GraphEdge = typeof graphEdges.$inferSelect;
export type NewGraphEdge = typeof graphEdges.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
