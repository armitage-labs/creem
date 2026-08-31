import { FRAMER_INTEGRATION_DOCS_URL } from '@/constants'
import { badge, cn } from '@/styles/ui'

export function DocsBadge() {
  return (
    <a
      href={FRAMER_INTEGRATION_DOCS_URL}
      target='_blank'
      rel='noopener noreferrer'
      className={cn(badge, 'no-underline hover:text-black')}
      aria-label='Open Framer integration documentation'
    >
      Docs
    </a>
  )
}
