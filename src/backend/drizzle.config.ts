import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/db/schema.ts', './src/db/schema.auth.ts', './src/db/schema.bots.ts', './src/db/schema.souls.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql:///janus?host=/run/postgresql',
  },
  verbose: true,
  strict: true,
});
