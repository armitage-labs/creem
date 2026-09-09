import { GENERATION_COST, PACKS } from '@/lib/packs'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Studio } from './studio'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <Studio
      user={{ name: user.name ?? user.email, email: user.email }}
      packs={PACKS.map((p) => ({ id: p.id, name: p.name, credits: p.credits, priceUsd: p.priceUsd, featured: !!p.featured }))}
      costs={GENERATION_COST}
    />
  )
}
