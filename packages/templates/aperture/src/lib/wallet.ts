import { randomUUID } from 'node:crypto'
import { CreemCreditsProvider } from './creem/credits-creem'
import { Balance, LedgerEntry, Transaction } from './creem/types'
import { pool, query, queryOne } from './db'

/**
 * The wallet layer is the single entry point every route and webhook uses to
 * touch a customer's credit balance. Credits live in the Creem Customer Credits
 * API - the single source of truth - and this layer:
 *   - maps app users to Creem credit accounts (credit_account table),
 *   - mirrors every movement into credit_ledger_cache for fast history + audit
 *     and to recover the transaction `reference` Creem's /entries omits.
 */

const credits = new CreemCreditsProvider()

export interface WalletAccount {
  userId: string
  creemCustomerId: string
  accountId: string
  unitLabel: string
  status: 'active' | 'frozen' | 'closed'
}

export async function getAccountForUser(userId: string): Promise<WalletAccount | null> {
  const row = await queryOne<{
    user_id: string
    creem_customer_id: string
    account_id: string
    unit_label: string
    status: 'active' | 'frozen' | 'closed'
  }>(`SELECT * FROM credit_account WHERE user_id = $1`, [userId])
  if (!row) return null
  return {
    userId: row.user_id,
    creemCustomerId: row.creem_customer_id,
    accountId: row.account_id,
    unitLabel: row.unit_label,
    status: row.status,
  }
}

/**
 * Ensure a Creem credit wallet exists for a user, creating one if needed.
 * `creemCustomerId` comes from a completed Creem checkout (the plugin sets
 * user.creemCustomerId on first purchase).
 */
export async function ensureAccountForUser(userId: string, creemCustomerId: string): Promise<WalletAccount> {
  const existing = await getAccountForUser(userId)
  if (existing) return existing
  // Two webhook deliveries for the same buyer can race here (e.g. Creem retries
  // an ambiguous delivery). Creem's createAccount has no idempotency key, so
  // without coordination both callers would pass the check above and each mint
  // a *separate* Creem wallet - the INSERT's ON CONFLICT dedupes the row but
  // leaves an orphaned second account. Serialise per-user creation behind a
  // transaction-scoped advisory lock and re-check inside it, so exactly one
  // wallet is ever created, and the loser of the race reuses it.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Lock key is derived from the user id. Released automatically on COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`credit_account:${userId}`])
    const again = await client.query(`SELECT user_id, creem_customer_id, account_id, unit_label, status FROM credit_account WHERE user_id = $1`, [userId])
    if (again.rows[0]) {
      await client.query('COMMIT')
      const r = again.rows[0]
      return { userId: r.user_id, creemCustomerId: r.creem_customer_id, accountId: r.account_id, unitLabel: r.unit_label, status: r.status }
    }
    const account = await credits.createAccount({ customerId: creemCustomerId, name: 'credits', unitLabel: 'credits' })
    await client.query(
      `INSERT INTO credit_account (user_id, creem_customer_id, account_id, provider, unit_label, status)
       VALUES ($1,$2,$3,'creem',$4,'active')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, creemCustomerId, account.id, account.unit_label],
    )
    await client.query('COMMIT')
    return { userId, creemCustomerId, accountId: account.id, unitLabel: account.unit_label, status: 'active' }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function getBalance(userId: string, at?: string): Promise<(Balance & { unitLabel: string }) | null> {
  const account = await getAccountForUser(userId)
  if (!account) return null
  const balance = await credits.getBalance(account.accountId, at)
  return { ...balance, unitLabel: account.unitLabel }
}

/** Credit a wallet when a customer buys a pack. Idempotent on `idempotencyKey`. */
export async function creditPack(args: { userId: string; accountId: string; amount: number; reference: string; idempotencyKey: string }): Promise<Transaction> {
  const result = await credits.credit(args.accountId, { amount: String(args.amount), reference: args.reference, idempotencyKey: args.idempotencyKey })
  await cacheMovement({
    userId: args.userId,
    accountId: args.accountId,
    transactionId: result.id,
    side: 'credit',
    amount: args.amount,
    reference: args.reference,
    kind: 'pack_purchase',
  })
  return result
}

/** Debit for a generation. Throws InsufficientBalanceError if too low. */
export async function debitForGeneration(args: { userId: string; accountId: string; amount: number; reference: string; idempotencyKey: string }): Promise<Transaction> {
  const result = await credits.debit(args.accountId, { amount: String(args.amount), reference: args.reference, idempotencyKey: args.idempotencyKey })
  await cacheMovement({
    userId: args.userId,
    accountId: args.accountId,
    transactionId: result.id,
    side: 'debit',
    amount: args.amount,
    reference: args.reference,
    kind: 'generation',
  })
  return result
}

/** Reverse a debit (e.g. generation failed after we charged). Idempotent. */
export async function refundDebit(args: { userId: string; accountId: string; transactionId: string; amount: number; reference: string }): Promise<Transaction> {
  const result = await credits.reverse(args.accountId, args.transactionId)
  await cacheMovement({ userId: args.userId, accountId: args.accountId, transactionId: result.id, side: 'credit', amount: args.amount, reference: args.reference, kind: 'refund' })
  return result
}

export async function listHistory(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const account = await getAccountForUser(userId)
  if (!account) return []
  const entries = await credits.listEntries(account.accountId, limit)
  // Creem's /entries omits the transaction `reference`; enrich from our cache
  // mirror (keyed by transaction id) so history labels are meaningful.
  const refs = await query<{ transaction_id: string; reference: string | null; kind: string | null }>(
    `SELECT transaction_id, reference, kind FROM credit_ledger_cache WHERE user_id=$1`,
    [userId],
  )
  const byTxn = new Map(refs.map((r) => [r.transaction_id, r]))
  return entries.map((e) => {
    const hit = byTxn.get(e.transaction_id)
    return e.reference ? e : { ...e, reference: hit?.reference ?? hit?.kind ?? null }
  })
}

// --- account lifecycle (ops) ------------------------------------------------

export async function freezeAccount(userId: string): Promise<void> {
  const account = await requireAccount(userId)
  await credits.freeze(account.accountId)
  await query(`UPDATE credit_account SET status='frozen', updated_at=now() WHERE user_id=$1`, [userId])
}

export async function unfreezeAccount(userId: string): Promise<void> {
  const account = await requireAccount(userId)
  await credits.unfreeze(account.accountId)
  await query(`UPDATE credit_account SET status='active', updated_at=now() WHERE user_id=$1`, [userId])
}

export async function closeAccount(userId: string): Promise<void> {
  const account = await requireAccount(userId)
  await credits.close(account.accountId)
  await query(`UPDATE credit_account SET status='closed', updated_at=now() WHERE user_id=$1`, [userId])
}

async function requireAccount(userId: string): Promise<WalletAccount> {
  const account = await getAccountForUser(userId)
  if (!account) throw new Error('no_wallet')
  return account
}

/** Mirror a movement into the audit/cache table. Best-effort, never throws. */
async function cacheMovement(m: {
  userId: string
  accountId: string
  transactionId: string
  side: 'credit' | 'debit'
  amount: number
  reference: string
  kind: string
}): Promise<void> {
  try {
    await query(
      `INSERT INTO credit_ledger_cache (id, user_id, account_id, transaction_id, side, amount, reference, kind)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [`clc_${randomUUID().replace(/-/g, '').slice(0, 20)}`, m.userId, m.accountId, m.transactionId, m.side, m.amount, m.reference, m.kind],
    )
  } catch (err) {
    console.warn('[wallet] cache write failed (non-fatal):', (err as Error).message)
  }
}
