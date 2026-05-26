import { pgTable, text, timestamp, integer, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';

export const testBots = pgTable('test_bots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('offline'),
  isPublic: boolean('is_public').default(false),
  scopes: jsonb('scopes').$type<string[]>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

type TestInsert = typeof testBots.$inferInsert;
const test: TestInsert = {
  id: 'test',
  name: 'test',
  displayName: 'test',
  description: 'test',
  status: 'online',
  isPublic: false,
  scopes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};
