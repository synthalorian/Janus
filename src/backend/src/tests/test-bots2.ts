import { testBots2 } from '../db/schema.bots-test.js';
type TestInsert = typeof testBots2.$inferInsert;
const test: TestInsert = {
  id: 'test',
  name: 'test',
  displayName: 'test',
  status: 'online',
  isPublic: false,
  scopes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};
