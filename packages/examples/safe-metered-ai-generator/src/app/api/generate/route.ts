import { screenPrompt } from '@/lib/creem/moderation'
import { InsufficientBalanceError } from '@/lib/creem/types'
import { pool, query, queryOne } from '@/lib/db'
import { getGenerator } from '@/lib/generator'
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL, dataUrlByteLength } from '@/lib/limits'
import { GENERATION_COST, MediaType } from '@/lib/packs'
import { withUser } from '@/lib/session'
import { debitForGeneration, getAccountForUser, refundDebit } from '@/lib/wallet'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

export const runtime = 'nodejs'

const Body = z.object({
  prompt: z.string().min(1).max(2000),
  mediaType: z.enum(['image', 'video']).default('image'),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/[a-z0-9.+-]+;base64,/i, 'must be a base64 image data URL')
    .optional(),
  options: z.record(z.string(), z.string()).optional(),
  // Client-supplied idempotency key so retries don't double-charge/generate.
  idempotencyKey: z.string().min(8).max(120).optional(),
})

/**
 * The metered generation endpoint. The ordering is deliberate and must not be
 * reordered. It is the whole point of the app:
 *
 *   1. MODERATE: screen the prompt first; block on deny/flag; fail closed.
 *   2. DEBIT: charge credits up front (idempotent); reject if insufficient.
 *   3. GENERATE: call the (swappable) model.
 *   4. RETURN: on success return the asset; on model failure REVERSE the debit
 *              so the user isn't charged for a failed generation.
 */
export const POST = withUser(async (req, user) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', details: z.flattenError(parsed.error) }, { status: 400 })
  const { prompt, mediaType, imageDataUrl, options } = parsed.data
  // Enforce the reference-image cap server-side too (the client checks it, but
  // the client can't be trusted): a base64 data URL over ~2.5 MB of image would
  // risk Vercel's 4.5 MB request limit once inflated. Fail closed on anything
  // that isn't a decodable data URL.
  if (imageDataUrl) {
    const bytes = dataUrlByteLength(imageDataUrl)
    if (bytes === null) return NextResponse.json({ error: 'invalid_image', message: 'Reference image must be a base64 data URL.' }, { status: 400 })
    if (bytes > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'image_too_large', message: `Reference image must be under ${MAX_IMAGE_LABEL}.` }, { status: 413 })
  }
  const idempotencyKey = parsed.data.idempotencyKey ?? `gen_${randomUUID()}`
  const cost = GENERATION_COST[mediaType as MediaType]
  const genId = `gen_${randomUUID().replace(/-/g, '').slice(0, 20)}`

  // The metered flow below (idempotency check → moderate → debit → generate →
  // return) must run at most once per request, even when a retry races the
  // original in flight. We run it while holding a per-(user, idempotency key)
  // advisory lock on a dedicated connection: a racing duplicate blocks until the
  // first finishes, then falls into the replay path instead of debiting again or
  // firing a second model call. Independent generations use different keys and
  // never contend.
  const runGeneration = async () => {
    // Idempotency: if this key already produced a completed generation, replay it.
    const prior = await queryOne<{ id: string; status: string; result_url: string | null }>(
      `SELECT id, status, result_url FROM generation WHERE user_id=$1 AND idempotency_key=$2 ORDER BY created_at DESC LIMIT 1`,
      [user.id, idempotencyKey],
    )
    if (prior && prior.status === 'completed') return NextResponse.json({ id: prior.id, status: 'completed', url: prior.result_url, replayed: true })
    const account = await getAccountForUser(user.id)
    if (!account) return NextResponse.json({ error: 'no_wallet', message: 'Buy a credit pack to start generating.' }, { status: 402 })
    if (account.status !== 'active') return NextResponse.json({ error: 'account_' + account.status, message: `Your credit account is ${account.status}.` }, { status: 403 })
    // ---- 1. MODERATE ------------------------------------------------------
    const moderation = await screenPrompt(prompt, `user_${user.id}:gen_${genId}`)
    if (!moderation.allowed) {
      await recordGeneration({ genId, userId: user.id, prompt, mediaType, cost, status: 'rejected', decision: moderation.decision, idempotencyKey })
      return NextResponse.json({ id: genId, status: 'rejected', decision: moderation.decision, error: 'prompt_rejected', message: moderation.reason }, { status: 400 })
    }
    // ---- 2. DEBIT ---------------------------------------------------------
    let debitTxnId: string
    try {
      const txn = await debitForGeneration({
        userId: user.id,
        accountId: account.accountId,
        amount: cost,
        reference: `gen:${genId}`,
        idempotencyKey: `debit_${idempotencyKey}`,
      })
      debitTxnId = txn.id
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        await recordGeneration({ genId, userId: user.id, prompt, mediaType, cost, status: 'insufficient_credits', decision: moderation.decision, idempotencyKey })
        return NextResponse.json(
          { id: genId, status: 'insufficient_credits', error: 'insufficient_credits', message: `You need ${cost} credits for this ${mediaType}.` },
          { status: 402 },
        )
      }
      console.error('[generate] debit failed:', err)
      return NextResponse.json({ error: 'billing_error', message: 'Could not reserve credits. Please try again.' }, { status: 502 })
    }
    await recordGeneration({ genId, userId: user.id, prompt, mediaType, cost, status: 'generating', decision: moderation.decision, idempotencyKey, debitTxnId })
    // ---- 3. GENERATE ------------------------------------------------------
    try {
      const generator = getGenerator()
      const result = await generator.generate({ prompt, mediaType, imageDataUrl, options, requestId: genId })
      // ---- 4. RETURN ------------------------------------------------------
      await query(`UPDATE generation SET status='completed', result_url=$2 WHERE id=$1`, [genId, result.url])
      return NextResponse.json({ id: genId, status: 'completed', url: result.url, mediaType: result.mediaType, cost, meta: result.meta })
    } catch (err) {
      // Model failed AFTER we charged. Reverse the debit so the user keeps their
      // credits, but only report 'refunded' once the reversal actually lands.
      console.error('[generate] model failed, reversing debit:', err)
      try {
        await refundDebit({ userId: user.id, accountId: account.accountId, transactionId: debitTxnId, amount: cost, reference: `refund:${genId}` })
      } catch (refundErr) {
        // Reversal failed: the user is still charged. Don't claim a refund that
        // never happened. Mark it failed for reconciliation and say so.
        console.error('[generate] REFUND FAILED - manual reconciliation needed for', genId, refundErr)
        await query(`UPDATE generation SET status='failed', error=$2 WHERE id=$1`, [genId, 'generation+refund failed'])
        return NextResponse.json(
          {
            id: genId,
            status: 'failed',
            error: 'generation_failed',
            message: 'Generation failed and your credits could not be automatically refunded - our team will reconcile this shortly.',
          },
          { status: 502 },
        )
      }
      // Reversal succeeded, so now it's safe to record and report the refund.
      await query(`UPDATE generation SET status='refunded', error=$2 WHERE id=$1`, [genId, String((err as Error).message).slice(0, 500)])
      return NextResponse.json({ id: genId, status: 'refunded', error: 'generation_failed', message: 'Generation failed - your credits were refunded.' }, { status: 502 })
    }
  }

  const lockName = `gen:${user.id}:${idempotencyKey}`
  const lockClient = await pool.connect()
  try {
    await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [lockName])
    return await runGeneration()
  } finally {
    try {
      await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName])
      lockClient.release()
    } catch (unlockErr) {
      // Destroy the connection so a session lock that failed to release can never
      // return to the pool still held.
      lockClient.release(unlockErr as Error)
    }
  }
})

async function recordGeneration(g: {
  genId: string
  userId: string
  prompt: string
  mediaType: string
  cost: number
  status: string
  decision: string
  idempotencyKey: string
  debitTxnId?: string
}): Promise<void> {
  await query(
    `INSERT INTO generation (id, user_id, prompt, media_type, cost, status, moderation_decision, debit_txn_id, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, moderation_decision=EXCLUDED.moderation_decision, debit_txn_id=EXCLUDED.debit_txn_id`,
    [g.genId, g.userId, g.prompt, g.mediaType, g.cost, g.status, g.decision, g.debitTxnId ?? null, g.idempotencyKey],
  )
}
