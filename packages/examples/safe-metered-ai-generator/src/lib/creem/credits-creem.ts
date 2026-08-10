import type { AccountResponseDto, BalanceResponseDto, EntryResponseDto, TransactionResponseDto } from 'creem/models/components'
import { CreemError } from 'creem/models/errors'
import { creemClient } from './client'
import { Balance, CreditAccount, CreditsProvider, InsufficientBalanceError, LedgerEntry, Transaction } from './types'

/**
 * CreditsProvider backed by the Creem Customer Credits API, using the official
 * `creem` SDK (`creemClient.customerCredits.*`). The SDK owns URL building, the
 * `x-api-key` header, request/response validation and (de)serialisation; this
 * class just maps the SDK's camelCase DTOs onto the app's internal snake_case
 * provider types so callers stay agnostic to which backend serves a request.
 */
export class CreemCreditsProvider implements CreditsProvider {
  readonly kind = 'creem' as const

  async createAccount(input: { customerId: string; name?: string; unitLabel?: string; initialBalance?: string }): Promise<CreditAccount> {
    const account = await creemClient.customerCredits.createAccount({
      customerId: input.customerId,
      name: input.name ?? 'credits',
      unitLabel: input.unitLabel ?? 'credits',
      ...(input.initialBalance ? { initialBalance: input.initialBalance } : {}),
    })
    return toAccount(account)
  }

  async getBalance(accountId: string, at?: string): Promise<Balance> {
    const balance = await creemClient.customerCredits.getAccountBalance(accountId, at)
    return toBalance(balance)
  }

  async credit(accountId: string, input: { amount: string; reference: string; idempotencyKey: string }): Promise<Transaction> {
    const txn = await creemClient.customerCredits.creditAccount(accountId, {
      amount: input.amount,
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
    })
    return toTransaction(txn)
  }

  async debit(accountId: string, input: { amount: string; reference: string; idempotencyKey: string }): Promise<Transaction> {
    try {
      const txn = await creemClient.customerCredits.debitAccount(accountId, {
        amount: input.amount,
        reference: input.reference,
        idempotencyKey: input.idempotencyKey,
      })
      return toTransaction(txn)
    } catch (err) {
      if (isInsufficient(err)) throw new InsufficientBalanceError()
      throw err
    }
  }

  async reverse(accountId: string, transactionId: string): Promise<Transaction> {
    const txn = await creemClient.customerCredits.reverseTransaction(accountId, { transactionId })
    return toTransaction(txn)
  }

  async listEntries(accountId: string, limit = 50): Promise<LedgerEntry[]> {
    const page = await creemClient.customerCredits.listEntries(accountId, limit)
    return (page.result.data ?? []).map(toLedgerEntry)
  }

  async freeze(accountId: string): Promise<void> {
    await creemClient.customerCredits.freezeAccount(accountId)
  }

  async unfreeze(accountId: string): Promise<void> {
    await creemClient.customerCredits.unfreezeAccount(accountId)
  }

  async close(accountId: string): Promise<void> {
    await creemClient.customerCredits.closeAccount(accountId)
  }
}

// --- DTO mappers (SDK camelCase -> internal snake_case) ---------------------

function toAccount(a: AccountResponseDto): CreditAccount {
  return {
    id: a.id,
    customer_id: a.customerId,
    name: a.name,
    unit_label: a.unitLabel,
    status: a.status,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  }
}

function toBalance(b: BalanceResponseDto): Balance {
  return { balance: b.balance, as_of: b.asOf, updated_at: b.updatedAt }
}

function toLedgerEntry(e: EntryResponseDto): LedgerEntry {
  return {
    id: e.id,
    transaction_id: e.transactionId,
    account_id: e.accountId,
    side: e.side,
    amount: e.amount,
    created_at: e.createdAt,
  }
}

function toTransaction(t: TransactionResponseDto): Transaction {
  return {
    id: t.id,
    reference: t.reference,
    idempotency_key: t.idempotencyKey,
    reversal_of: t.reversalOf,
    entries: t.entries.map(toLedgerEntry),
    created_at: t.createdAt,
  }
}

/**
 * A debit that would push the balance below zero surfaces as a Creem API error.
 * Detect it from the HTTP status (422) or an "insufficient" marker in the body
 * so the wallet layer can translate it into a clean InsufficientBalanceError
 * rather than falling back to the local ledger.
 */
function isInsufficient(err: unknown): boolean {
  if (!(err instanceof CreemError)) return false
  if (err.statusCode === 422) return true
  return (err.body ?? '').toLowerCase().includes('insufficient')
}
