import { CreemError, CustomerCreditsErrorResponseDto } from 'creem/models/errors'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { customerOwnership } from './customers'
import { errorCode, toDebitError } from './errors'
import { InsufficientBalanceError, ModerationDebitError } from './types'

/**
 * How Creem's debit errors become the app's typed errors. No network: the SDK
 * errors are built by hand, the same way the SDK builds them from a response.
 */

function httpMeta(status: number, body: string) {
  return { response: new Response(body, { status }), request: new Request('https://test-api.creem.io/v1/x'), body }
}

/** A status the SDK does not type (a 400, say): a plain CreemError with the raw body. */
function untyped(status: number, body: string): CreemError {
  return new CreemError(`API error occurred: Status ${status}`, httpMeta(status, body))
}

/** A 409 or 422, which the SDK parses into a typed error. */
function typed(status: number, code: string): CustomerCreditsErrorResponseDto {
  const error = { type: 'invalid_request_error' as const, code, message: code, requestId: 'req_test' }
  return new CustomerCreditsErrorResponseDto({ error }, httpMeta(status, JSON.stringify({ error })))
}

describe('errorCode', () => {
  test('reads the code from a typed 409/422 error', () => {
    assert.equal(errorCode(typed(422, 'insufficient_balance')), 'insufficient_balance')
  })

  test('reads the code from the raw body of an untyped error', () => {
    assert.equal(errorCode(untyped(400, '{"error":{"code":"moderation_id_required","message":"x"}}')), 'moderation_id_required')
  })

  test('returns null when there is no code to read', () => {
    assert.equal(errorCode(untyped(502, '<html>Bad Gateway</html>')), null)
    assert.equal(errorCode(untyped(400, '{"error":"bad request"}')), null)
    assert.equal(errorCode(new Error('network down')), null)
  })
})

describe('toDebitError', () => {
  test('insufficient_balance becomes InsufficientBalanceError', () => {
    assert.ok(toDebitError(typed(422, 'insufficient_balance')) instanceof InsufficientBalanceError)
  })

  test('every moderation_* code becomes ModerationDebitError, typed or not', () => {
    for (const err of [typed(409, 'moderation_result_already_used'), untyped(400, '{"error":{"code":"moderation_result_expired"}}')]) {
      const mapped = toDebitError(err)
      assert.ok(mapped instanceof ModerationDebitError)
      assert.match(mapped.code, /^moderation_/)
    }
  })

  test('anything else is passed through unchanged', () => {
    const conflict = typed(409, 'idempotency_key_mismatch')
    assert.equal(toDebitError(conflict), conflict)
    const outage = untyped(500, 'oops')
    assert.equal(toDebitError(outage), outage)
  })
})

describe('customerOwnership', () => {
  test('a customer carrying this user id is theirs', () => {
    assert.equal(customerOwnership({ externalId: 'user_1' }, 'user_1'), 'own')
  })

  test('a customer carrying another user id is refused', () => {
    assert.equal(customerOwnership({ externalId: 'user_2' }, 'user_1'), 'refuse')
  })

  test('a customer without a user id is claimed', () => {
    assert.equal(customerOwnership({ externalId: null }, 'user_1'), 'claim')
    assert.equal(customerOwnership({}, 'user_1'), 'claim')
  })
})
