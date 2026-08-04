import { query } from '@/lib/db'
import { withUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** The signed-in user's generation gallery, newest first. */
export const GET = withUser(async (_req, user) => {
  const rows = await query<{
    id: string
    prompt: string
    media_type: string
    cost: number
    status: string
    moderation_decision: string | null
    result_url: string | null
    created_at: string
  }>(
    `SELECT id, prompt, media_type, cost, status, moderation_decision, result_url, created_at
     FROM generation WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60`,
    [user.id],
  )
  return NextResponse.json({
    generations: rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      mediaType: r.media_type,
      cost: r.cost,
      status: r.status,
      decision: r.moderation_decision,
      url: r.result_url,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  })
})
