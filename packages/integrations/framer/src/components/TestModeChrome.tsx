import type { ReactNode } from 'react'
import { FlaskConical } from '@/icons'

const TEST_ACCENT = '#FFBE98' // creem brand peach — mirrors Creem's dashboard "Test mode on" chrome

/**
 * Wraps the whole plugin in a peach frame + a persistent "Test mode on" bar
 * whenever the active environment is test — the same unmissable signal Creem's
 * dashboard uses. Rendered around every connected screen so env is always obvious.
 *
 * The wrapper is kept structurally identical whether or not test mode is active
 * (only opacity/height animate) so toggling the environment never remounts the
 * children and loses in-flight wizard state.
 */
export function TestModeChrome({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className='relative flex h-full w-full flex-col'>
      <div className='min-h-0 flex-1'>{children}</div>
      <div className='shrink-0 overflow-hidden transition-[height] duration-200' style={{ height: active ? 30 : 0 }} aria-hidden={!active}>
        <div className='flex h-[30px] items-center justify-center gap-1.5 text-[11px] font-black tracking-wide text-black' style={{ background: TEST_ACCENT }}>
          <FlaskConical className='h-3.5 w-3.5' />
          Test mode on
        </div>
      </div>
      {/* Amber ring overlay — drawn above content, never intercepts clicks. */}
      <div
        className='pointer-events-none absolute inset-0 transition-opacity duration-200'
        style={{ boxShadow: `inset 0 0 0 3px ${TEST_ACCENT}`, opacity: active ? 1 : 0 }}
        aria-hidden='true'
      />
    </div>
  )
}
