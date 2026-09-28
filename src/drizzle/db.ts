import { loadEnvConfig } from '@next/env';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { relations } from './relations';

loadEnvConfig(process.cwd());

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) throw new Error(
    'Please define the DATABASE_URL environment variable inside .env'
)

const globalForDb = global as unknown as { client: postgres.Sql | undefined }

const client = globalForDb.client ?? postgres(DATABASE_URL, { prepare: false })

if (process.env.NODE_ENV !== 'production') {
    globalForDb.client = client
}

export const db = drizzle({ client, relations })

