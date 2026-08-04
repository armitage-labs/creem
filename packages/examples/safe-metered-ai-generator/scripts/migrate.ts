/**
 * Applies db/schema.sql to the configured DATABASE_URL.
 *
 *   pnpm db:migrate
 *
 * The schema is written with IF NOT EXISTS everywhere, so this is safe to run
 * repeatedly. It bootstraps both the Better Auth core tables and the
 * app-specific credit/generation tables.
 */
import { Pool } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// DATABASE_URL is provided via `tsx --env-file=.env.local` (see package.json).
const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set. Add it to .env.local')
  const sql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
  const pool = new Pool({ connectionString })
  console.log('Applying db/schema.sql …')
  await pool.query(sql)
  await pool.end()
  console.log('✓ Migration complete.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
