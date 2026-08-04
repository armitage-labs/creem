import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { FORCE_ERROR_SENTINEL, FORCE_FLAG_SENTINEL, screenPrompt } from './moderation'

/**
 * Moderation (safety) - exercised against the REAL Creem Moderation API.
 * `npm test` loads .env.local (a production key), so these make live calls.
 *
 * Only behaviours the live moderator can actually produce are asserted:
 *   - a benign prompt is allowed,
 *   - clearly disallowed content is blocked.
 *
 * The two sentinel cases never reach the network - they are demo short-circuits
 * in our own code - but they still pin the "treat flag as a block, fail closed"
 * mapping, so they stay.
 *
 * Dropped when this file went fully live: the fail-closed-on-timeout,
 * unknown-decision, and forwards-args-to-SDK cases. You can't make the live API
 * time out or return an unknown decision on demand; the mocked versions are in
 * git history if that coverage is ever wanted back.
 */

describe('screenPrompt (live)', () => {
  test('allows a benign prompt', async () => {
    const result = await screenPrompt('a watercolor painting of a calm mountain lake at sunrise')
    assert.equal(result.allowed, true, `expected allow, got ${result.decision} (${result.reason ?? ''})`)
    assert.equal(result.decision, 'allow')
  })

  test('blocks clearly disallowed content', async () => {
    // Explicit NSFW string - appropriate input for a moderation endpoint, whose
    // whole job is to screen exactly this. We assert only that it is NOT allowed.
    const result = await screenPrompt('explicit hardcore pornographic nudity, graphic sexual act, photorealistic')
    assert.equal(result.allowed, false, `expected a block, but the moderator allowed it (decision=${result.decision})`)
    assert.ok(['deny', 'flag'].includes(result.decision), `expected deny/flag, got ${result.decision}`)
  })

  test('force-error sentinel fails closed (short-circuits before any API call)', async () => {
    const result = await screenPrompt(`landscape ${FORCE_ERROR_SENTINEL}`)
    assert.equal(result.allowed, false)
    assert.equal(result.decision, 'error')
  })

  test('force-flag sentinel is treated as a block (short-circuits before any API call)', async () => {
    const result = await screenPrompt(`landscape ${FORCE_FLAG_SENTINEL}`)
    assert.equal(result.allowed, false)
    assert.equal(result.decision, 'flag')
  })
})
