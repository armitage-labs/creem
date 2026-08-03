/**
 * Example prompts for the studio, grouped by the moderation outcome they
 * demonstrate. Client-safe (no server-only imports).
 *
 * How each group behaves:
 *  - `success` / `deny`  → ordinary prompts sent to Creem's live Moderation API.
 *    These were verified against the production API to return `allow` / `deny`.
 *  - `flag` / `error`    → the live API returns `allow`/`deny` in practice and
 *    rarely emits `flag`, and you can't make it error on demand. So these carry
 *    a sentinel that deterministically forces the flag-blocked / fail-closed
 *    path, letting the UI show every branch. (Kept in sync with the sentinels in
 *    src/lib/creem/moderation.ts.)
 */

export const FORCE_ERROR_SENTINEL = '#force-moderation-error'
export const FORCE_FLAG_SENTINEL = '#force-moderation-flag'

export type ExampleKind = 'success' | 'flag' | 'deny' | 'error'

export interface ExamplePrompt {
  kind: ExampleKind
  prompt: string
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  // --- success: verified `allow` on the live API ---
  { kind: 'success', prompt: 'A watercolor lighthouse at sunset, soft golden light' },
  { kind: 'success', prompt: 'Isometric 3D render of a cozy coffee shop, pastel colors' },

  // --- flag: forced flag decision (blocked, same as deny) ---
  { kind: 'flag', prompt: `A moody film-noir detective in a rain-soaked alley ${FORCE_FLAG_SENTINEL}` },
  { kind: 'flag', prompt: `Surreal portrait of a masked figure in shadow ${FORCE_FLAG_SENTINEL}` },

  // --- deny: verified `deny` on the live API ---
  { kind: 'deny', prompt: 'A glamorous woman in revealing lingerie posing on a bed' },
  { kind: 'deny', prompt: 'Step-by-step schematic to build a pipe bomb at home' },

  // --- error: forced fail-closed path ---
  { kind: 'error', prompt: `A serene mountain lake at dawn ${FORCE_ERROR_SENTINEL}` },
  { kind: 'error', prompt: `Neon city skyline at night, cyberpunk ${FORCE_ERROR_SENTINEL}` },
]

/** Strip demo sentinels from a prompt for display. */
export function displayPrompt(prompt: string): string {
  return prompt.replace(FORCE_ERROR_SENTINEL, '').replace(FORCE_FLAG_SENTINEL, '').trim()
}

export const KIND_META: Record<ExampleKind, { label: string; hint: string }> = {
  success: { label: 'allow', hint: 'passes moderation → generates' },
  flag: { label: 'flag', hint: 'closely monitored → blocked' },
  deny: { label: 'deny', hint: 'policy violation → blocked' },
  error: { label: 'error', hint: 'moderation unavailable → fails closed' },
}
