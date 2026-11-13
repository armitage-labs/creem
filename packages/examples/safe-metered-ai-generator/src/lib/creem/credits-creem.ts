import type { AccountResponseDto, BalanceResponseDto, EntryResponseDto, TransactionResponseDto } from 'creem/models/components'
import { CreemError, CustomerCreditsErrorResponseDto } from 'creem/models/errors'
import { creemClient } from './client'
import { Balance, CreditAccount, CreditsProvider, InsufficientBalanceError, LedgerEntry, ModerationDebitError, Transaction } from './types'

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

  /** The customer's wallet with this name, or null. Names are unique per customer. */
  async findAccount(customerId: string, name: string): Promise<CreditAccount | null> {
    const page = await creemClient.customerCredits.listAccounts(100, customerId)
    const match = (page.result.data ?? []).find((a) => a.name === name)
    return match ? toAccount(match) : null
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

  /**
   * `moderationId` is required when the account is the `generation` wallet:
   * Creem checks that the moderation result is `allow`, at most 24 hours old
   * and not used by another debit before it moves any credits.
   */
  async debit(accountId: string, input: { amount: string; reference: string; idempotencyKey: string; moderationId?: string }): Promise<Transaction> {
    try {
      const txn = await creemClient.customerCredits.debitAccount(accountId, {
        amount: input.amount,
        reference: input.reference,
        idempotencyKey: input.idempotencyKey,
        ...(input.moderationId ? { moderationId: input.moderationId } : {}),
      })
      return toTransaction(txn)
    } catch (err) {
      const code = errorCode(err)
      if (code === 'insufficient_balance') throw new InsufficientBalanceError()
      if (code?.startsWith('moderation_')) throw new ModerationDebitError(code)
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

/** Creem's machine-readable error code (`insufficient_balance`, `moderation_denied`, ...), if any. */
function errorCode(err: unknown): string | null {
  if (err instanceof CustomerCreditsErrorResponseDto) return err.error.code
  // The SDK only types 409 and 422 responses. Other statuses (a 400 for most
  // `moderation_*` codes) arrive as a plain CreemError with the raw JSON body.
  if (!(err instanceof CreemError)) return null
  try {
    const code: unknown = JSON.parse(err.body)?.error?.code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}
