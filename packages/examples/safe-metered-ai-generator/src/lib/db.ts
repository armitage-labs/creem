import { Pool } from '@neondatabase/serverless'
import { env } from './env'

/**
 * A single shared Neon connection pool.
 *
 * The same pool is handed to Better Auth (which wraps it with Kysely) and used
 * directly by our own ledger/generation queries, so everything shares one set
 * of connections. Cached on `globalThis` to survive Next.js dev hot-reloads.
 */
const globalForDb = globalThis as unknown as { __pool?: Pool }

export const pool: Pool = globalForDb.__pool ?? new Pool({ connectionString: env.databaseUrl })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__pool = pool
}

/** Thin tagged helper around pool.query that returns typed rows. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params as never[])
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}
