import { users } from '../db/schema.js';

type UserInsert = typeof users.$inferInsert;
const test: UserInsert = {
  id: 'test',
  name: 'test',
  type: 'human',
  trustLevel: 1,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};
