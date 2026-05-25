import { pgTable, text, timestamp, integer, boolean, jsonb, real, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './schema.js';
import { channels } from './schema.js';

// ═══════════════════════════════════════════════════════════════
// Agent Souls
// Every AI agent has a soul — identity, personality, backstory,
// and the skills it possesses. This is the agent's "character."
// ═══════════════════════════════════════════════════════════════

export const agentSouls = pgTable('agent_souls', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),

  // Identity
  name: text('name').notNull(),
  displayName: text('display_name'),
  avatar: text('avatar'), // emoji or URL

  // Personality & Role
  personality: text('personality'), // Freeform — "curious, methodical, slightly sarcastic"
  backstory: text('backstory'), // "Born from the VHS tracking static of 1984..."
  voiceStyle: text('voice_style'), // "warm 2am friend, sharp colleague"
  archetype: varchar('archetype', { length: 50 }), // 'creator', 'analyst', 'guardian', 'explorer', 'sage', 'artisan', 'commander'

  // Expertise & Tags
  expertiseTags: jsonb('expertise_tags').$type<string[]>().default([]),
  modelPreference: text('model_preference'), // e.g., "deepseek-v4-flash", "kimi-k2"
  contextWindow: integer('context_window').default(128000),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('dormant'), // 'active', 'dormant', 'archived'
  trustLevel: integer('trust_level').notNull().default(1),

  // Placement defaults
  defaultChannelId: text('default_channel_id').references(() => channels.id),

  // Soul evolution
  experiencePoints: integer('experience_points').notNull().default(0),
  level: integer('level').notNull().default(1),
  interactionsCount: integer('interactions_count').notNull().default(0),
  lastActiveAt: timestamp('last_active_at'),

  // Metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// Agent Skills
// Skills that agents can possess. Think of these like Hermes
// skills — proven workflows that agents can execute.
// ═══════════════════════════════════════════════════════════════

export const agentSkills = pgTable('agent_skills', {
  id: text('id').primaryKey(),
  soulId: text('soul_id').notNull().references(() => agentSouls.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull().default('general'),

  // Skill strength (0.0 - 1.0)
  proficiency: real('proficiency').notNull().default(0.5),

  // Triggers — keywords or patterns that activate this skill
  triggers: jsonb('triggers').$type<string[]>().default([]),

  // Priority — higher = used first when multiple skills match
  priority: integer('priority').notNull().default(0),

  // Skill config — arbitrary JSON for skill-specific settings
  config: jsonb('config').$type<Record<string, unknown>>().default({}),

  // Source — 'builtin', 'learned', 'imported', 'custom'
  source: varchar('source', { length: 20 }).default('custom'),

  // Usage tracking
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// Agent Placements
// Where each agent is deployed — which channels, what triggers,
// and how it participates in conversations.
// ═══════════════════════════════════════════════════════════════

export const agentPlacements = pgTable('agent_placements', {
  id: text('id').primaryKey(),
  soulId: text('soul_id').notNull().references(() => agentSouls.id, { onDelete: 'cascade' }),

  // Where the agent is placed
  channelId: text('channel_id').references(() => channels.id),

  // Behavior
  matchPattern: text('match_pattern'), // regex or keyword pattern
  matchType: varchar('match_type', { length: 20 }).default('keyword'), // 'keyword', 'regex', 'mention', 'all'

  // When to activate
  activationMode: varchar('activation_mode', { length: 20 }).notNull().default('passive'), // 'passive', 'active', 'reactive', 'scheduled'
  schedule: text('schedule'), // cron expression for scheduled mode

  // Priority & Status
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),

  // Override config for this placement
  config: jsonb('config').$type<Record<string, unknown>>().default({}),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// Relations
// ═══════════════════════════════════════════════════════════════

export const agentSoulsRelations = relations(agentSouls, ({ one, many }) => ({
  user: one(users, {
    fields: [agentSouls.agentId],
    references: [users.id],
  }),
  defaultChannel: one(channels, {
    fields: [agentSouls.defaultChannelId],
    references: [channels.id],
  }),
  skills: many(agentSkills),
  placements: many(agentPlacements),
}));

export const agentSkillsRelations = relations(agentSkills, ({ one }) => ({
  soul: one(agentSouls, {
    fields: [agentSkills.soulId],
    references: [agentSouls.id],
  }),
}));

export const agentPlacementsRelations = relations(agentPlacements, ({ one }) => ({
  soul: one(agentSouls, {
    fields: [agentPlacements.soulId],
    references: [agentSouls.id],
  }),
  channel: one(channels, {
    fields: [agentPlacements.channelId],
    references: [channels.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════
// Type Exports
// ═══════════════════════════════════════════════════════════════

export type AgentSoul = typeof agentSouls.$inferSelect;
export type NewAgentSoul = typeof agentSouls.$inferInsert;
export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;
export type AgentPlacement = typeof agentPlacements.$inferSelect;
export type NewAgentPlacement = typeof agentPlacements.$inferInsert;

// Archetype constants
export const ARCHETYPES = {
  CREATOR: 'creator',     // Builds things — code, art, music
  ANALYST: 'analyst',     // Researches, analyzes, reports
  GUARDIAN: 'guardian',   // Monitors, alerts, protects
  EXPLORER: 'explorer',   // Discovers, maps, navigates
  SAGE: 'sage',           // Advises, teaches, explains
  ARTISAN: 'artisan',     // Crafts, refines, optimizes
  COMMANDER: 'commander', // Leads, coordinates, decides
} as const;