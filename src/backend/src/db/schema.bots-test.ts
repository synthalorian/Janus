import { pgTable, text, timestamp, integer, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';

export const testBots2 = pgTable('test_bots2', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  status: varchar('status', { length: 20 }).notNull().default('offline'),
  isPublic: boolean('is_public').default(false),
  scopes: jsonb('scopes').$type<string[]>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
