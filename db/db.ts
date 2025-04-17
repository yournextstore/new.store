import { invariant } from '@/lib/utils';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { loadEnvConfig } from '@next/env';
import type { DBQueryConfig, ExtractTablesWithRelations } from 'drizzle-orm';
import { type NeonQueryResultHKT, drizzle } from 'drizzle-orm/neon-serverless';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import ws from 'ws';
import * as schema from './schema';

loadEnvConfig('.');
neonConfig.webSocketConstructor = ws;

invariant(process.env.DATABASE_URL, 'DATABASE_URL is required');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, {
  schema,
  logger: false,
  casing: 'snake_case',
});
export { schema };

export type DrizzleClient = typeof db;

export default db;

export type Trx = PgTransaction<
  NeonQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
export type DbWith<TableName extends keyof TSchema> = DBQueryConfig<
  'one' | 'many',
  boolean,
  TSchema,
  TSchema[TableName]
>['with'];
type TSchema = ExtractTablesWithRelations<typeof schema>;
