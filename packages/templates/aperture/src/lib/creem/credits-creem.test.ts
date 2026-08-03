import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { creemClient } from './client'
import { CreemCreditsProvider } from './credits-creem'
import { InsufficientBalanceError } from './types'

/**
 * Credits money-path (retries + reversals) - exercised against the REAL Creem
 * Customer Credits API. `npm test` loads .env.local (a production key), so each
 * run creates a throwaway customer + credit account and real ledger entries in
 * your live Creem account, then closes the account in teardown. (The SDK has no
 * customer-delete, so the labelled throwaway customer row remains - harmless.)
 *
 * Dropped when this file went fully live: the non-422 "insufficient" body case
 * and the 500-rethrow case. The live API won't emit those on demand; the mocked
 * versions are in git history if that coverage is ever wanted back.
 */

const bal = (s: string) => Number.parseFloat(s)

describe('CreemCreditsProvider (live)', () => {
  const credits = new CreemCreditsProvider()
  let accountId: string | null = null

  after(async () => {
    // Best-effort teardown: leave no open account behind.
    if (accountId) {
      await credits.close(accountId).catch((e) => console.warn('[test] account close failed (manual cleanup):', (e as Error).message))
    }
  })

  test('create → credit → idempotent retry → debit → insufficient → reverse', async () => {
    // A throwaway customer to own the credit account.
    const customer = await creemClient.customers.create({
      email: `aperture-test+${randomUUID().slice(0, 8)}@example.com`,
      name: 'Aperture Test (safe to delete)',
    })
    assert.ok(customer.id, 'customer create returned no id')
    console.log(`[debug] customer from SDK -> email=${customer.email} name=${customer.name}`)

    // A fresh credit account starts at zero.
    const account = await credits.createAccount({ customerId: customer.id, name: 'credits', unitLabel: 'credits' })
    accountId = account.id
    assert.equal(bal((await credits.getBalance(account.id)).balance), 0, 'new account should start at 0')

    // Credit 10 -> balance 10.
    const creditKey = `test_credit_${randomUUID()}`
    await credits.credit(account.id, { amount: '10', reference: 'test:topup', idempotencyKey: creditKey })
    assert.equal(bal((await credits.getBalance(account.id)).balance), 10, 'after crediting 10')

    // RETRIES: replay the SAME credit with the SAME idempotency key. A retry must
    // NOT double-credit - the balance stays 10, proving Creem dedupes on the key
    // our provider forwards untouched.
    await credits.credit(account.id, { amount: '10', reference: 'test:topup', idempotencyKey: creditKey })
    assert.equal(bal((await credits.getBalance(account.id)).balance), 10, 'idempotent credit retry must not double-charge')

    // Debit 3 -> balance 7. Keep the txn id for the reversal.
    const debit = await credits.debit(account.id, { amount: '3', reference: 'test:spend', idempotencyKey: `test_debit_${randomUUID()}` })
    assert.equal(bal((await credits.getBalance(account.id)).balance), 7, 'after debiting 3')

    // INSUFFICIENT: a debit larger than the balance must surface as our typed
    // InsufficientBalanceError (mapped from Creem's live 422) and must NOT move
    // the balance.
    await assert.rejects(
      () => credits.debit(account.id, { amount: '99999', reference: 'test:overdraft', idempotencyKey: `test_over_${randomUUID()}` }),
      InsufficientBalanceError,
      'overdraft debit should raise InsufficientBalanceError',
    )
    assert.equal(bal((await credits.getBalance(account.id)).balance), 7, 'failed debit must not change the balance')

    // REVERSALS: reverse the earlier debit -> balance returns to 10.
    await credits.reverse(account.id, debit.id)
    assert.equal(bal((await credits.getBalance(account.id)).balance), 10, 'reversing the 3-debit should restore the balance to 10')
  })
})
