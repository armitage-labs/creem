/** Shared types for the Customer Credits + Moderation integrations. */

export type AccountStatus = 'active' | 'frozen' | 'closed'

export interface CreditAccount {
  id: string
  customer_id: string
  name: string
  unit_label: string
  status: AccountStatus
  created_at: string
  updated_at: string
}

export interface LedgerEntry {
  id: string
  transaction_id: string
  account_id: string
  side: 'credit' | 'debit'
  amount: string
  reference?: string | null
  created_at: string
}

export interface Transaction {
  id: string
  reference?: string | null
  idempotency_key?: string | null
  reversal_of?: string | null
  entries: LedgerEntry[]
  created_at: string
}

export interface Balance {
  balance: string
  /** Present on point-in-time (`?at=`) queries. */
  as_of?: string
  updated_at?: string
}

/**
 * The provider abstraction every wallet operation goes through. Two concrete
 * implementations exist: one backed by the Creem Customer Credits API, one by a
 * local Postgres ledger. Both satisfy this interface so callers never care
 * which is in use.
 */
export interface CreditsProvider {
  readonly kind: 'creem'
  createAccount(input: { customerId: string; name?: string; unitLabel?: string; initialBalance?: string }): Promise<CreditAccount>
  getBalance(accountId: string, at?: string): Promise<Balance>
  credit(accountId: string, input: { amount: string; reference: string; idempotencyKey: string }): Promise<Transaction>
  debit(accountId: string, input: { amount: string; reference: string; idempotencyKey: string }): Promise<Transaction>
  reverse(accountId: string, transactionId: string): Promise<Transaction>
  listEntries(accountId: string, limit?: number): Promise<LedgerEntry[]>
  freeze(accountId: string): Promise<void>
  unfreeze(accountId: string): Promise<void>
  close(accountId: string): Promise<void>
}

/** Thrown when a debit would push the balance below zero. */
export class InsufficientBalanceError extends Error {
  constructor(message = 'insufficient_balance') {
    super(message)
    this.name = 'InsufficientBalanceError'
  }
}
