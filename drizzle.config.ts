import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';
import { invariant } from './lib/utils';

loadEnvConfig('.');

invariant(process.env.DATABASE_URL, 'DATABASE_URL is required');
export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
