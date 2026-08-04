import { creemClient } from './client'

/**
 * Content moderation wrapper around the Creem Moderation API, called through the
 * official `creem` SDK (`creemClient.moderation.screenPrompt`).
 *
 * Design rules, straight from Creem's guidance:
 *   1. Screen the prompt BEFORE anything else (no debit, no generation first).
 *   2. Block on BOTH `deny` and `flag` - treat flag exactly like deny.
 *   3. Fail CLOSED - if the call errors or times out, block, never generate.
 */

export type ModerationDecision = 'allow' | 'flag' | 'deny' | 'error'

/**
 * Demo sentinels. In practice the live Moderation API returns `allow` or `deny`;
 * a `flag` decision is rare and hard to reproduce on demand. To let the UI
 * demonstrate the distinct flag-blocked and fail-closed paths deterministically,
 * a prompt may carry one of these markers. Both are harmless in production
 * (worst case: they block a request that would otherwise be screened normally).
 */
export const FORCE_ERROR_SENTINEL = '#force-moderation-error'
export const FORCE_FLAG_SENTINEL = '#force-moderation-flag'

export interface ModerationResult {
  decision: ModerationDecision
  /** True when generation is permitted. Only `allow` passes. */
  allowed: boolean
  /** A user-safe reason string when blocked. */
  reason?: string
  raw?: unknown
}

const BLOCK_MESSAGES: Record<Exclude<ModerationDecision, 'allow'>, string> = {
  deny: 'Your prompt was rejected because it violates our content policy. Please revise and try again.',
  flag: 'Your prompt could not be processed. Please revise and try again.',
  error: 'Moderation is temporarily unavailable. Please try again in a moment.',
}

/**
 * Screen a prompt. Returns `allowed: true` only on an explicit `allow`.
 * Any error, timeout, or unexpected response fails closed (blocked).
 */
export async function screenPrompt(prompt: string, externalId?: string): Promise<ModerationResult> {
  // Demo affordances (see sentinel docs above).
  if (prompt.includes(FORCE_ERROR_SENTINEL)) {
    return blocked('error')
  }
  if (prompt.includes(FORCE_FLAG_SENTINEL)) {
    return blocked('flag')
  }

  try {
    const data = await creemClient.moderation.screenPrompt(
      { prompt, externalId },
      // Short timeout - a slow moderator must not hold up the request forever.
      { timeoutMs: 5000 },
    )
    const decision = data.decision

    if (decision === 'allow') {
      return { decision: 'allow', allowed: true, raw: data }
    }
    if (decision === 'deny' || decision === 'flag') {
      return blocked(decision, data)
    }
    // Unknown/absent decision - do not assume safe. Fail closed.
    return blocked('error', data)
  } catch {
    // API error / network error / timeout - fail closed.
    return blocked('error')
  }
}

function blocked(decision: 'deny' | 'flag' | 'error', raw?: unknown): ModerationResult {
  return { decision, allowed: false, reason: BLOCK_MESSAGES[decision], raw }
}
