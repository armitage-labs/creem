const transition = 'transition-[box-shadow,transform] duration-200 ease-in-out'
const border = 'border-2 border-ui-border'
const roundedSm = 'rounded-lg'
const roundedMd = 'rounded-xl'
const roundedLg = 'rounded-2xl'

const liftSm = `${transition} shadow-[2px_2px_0_0_var(--ui-shadow)] hover:shadow-[3px_3px_0_0_var(--ui-shadow)] hover:-translate-x-px hover:-translate-y-px active:shadow-[1px_1px_0_0_var(--ui-shadow)] active:translate-x-px active:translate-y-px`
const liftMd = `${transition} shadow-[3px_3px_0_0_var(--ui-shadow)] hover:shadow-[5px_5px_0_0_var(--ui-shadow)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-[1px_1px_0_0_var(--ui-shadow)] active:translate-x-px active:translate-y-px`
const liftCard = `${transition} shadow-[3px_3px_0_0_var(--ui-shadow)] hover:shadow-[5px_5px_0_0_var(--ui-shadow)] hover:-translate-x-0.5 hover:-translate-y-0.5`

export const btn = {
  cta: `inline-flex w-full cursor-pointer items-center justify-center gap-2 ${border} bg-creem-peach text-creem-ink font-black ${roundedMd} px-4 py-3 ${liftMd} hover:bg-creem-peach hover:text-creem-ink disabled:cursor-not-allowed disabled:border-ui-border-subtle disabled:bg-ui-surface-subtle disabled:text-ui-text-subtle disabled:shadow-none disabled:translate-none`,
  compact: `inline-flex cursor-pointer items-center gap-1.5 ${border} bg-ui-bg text-ui-text font-black ${roundedSm} ${liftSm} hover:bg-ui-bg hover:text-ui-text`,
  dark: `inline-flex cursor-pointer items-center gap-1.5 ${border} bg-creem-ink text-white font-black ${roundedSm} min-h-8 px-3 ${liftSm} hover:bg-creem-ink hover:text-white`,
  logout: 'ml-auto w-[120px] text-xs',
  icon: `inline-flex size-7 shrink-0 cursor-pointer items-center justify-center p-0 ${border} bg-creem-purple text-creem-ink ${roundedSm} ${liftSm} hover:bg-creem-purple hover:text-creem-ink disabled:cursor-not-allowed disabled:border-ui-border-subtle disabled:bg-ui-surface-subtle disabled:text-ui-text-subtle disabled:shadow-none disabled:translate-none`,
  secondary: `inline-flex cursor-pointer items-center justify-center ${border} bg-ui-surface text-ui-text ${roundedSm} ${liftSm} hover:bg-ui-surface hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-none`,
  danger: `inline-flex cursor-pointer items-center justify-center ${border} bg-ui-surface text-ui-danger ${roundedSm} ${liftSm} hover:bg-ui-surface hover:text-ui-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-none`,
  dashed: `inline-flex w-full cursor-pointer items-center justify-center gap-1 ${border} border-dashed bg-ui-surface text-ui-text font-black ${roundedSm} ${liftSm} hover:bg-ui-surface hover:text-ui-text`,
  disclosure: 'flex w-full cursor-pointer items-center justify-between border-0 bg-transparent shadow-none hover:bg-transparent',
  iconSize: 'size-7 min-h-7 min-w-7 p-0',
  iconSizeLg: 'size-8 min-h-8 min-w-8 p-0'
} as const

export const toggle = {
  base: `cursor-pointer ${border} bg-ui-bg text-ui-text font-black ${roundedSm} ${liftSm} hover:bg-ui-bg hover:text-ui-text`,
  active: `cursor-pointer ${border} bg-creem-purple text-creem-ink font-black ${roundedSm} ${liftSm} hover:bg-creem-purple hover:text-creem-ink`,
  segment: (active: boolean) => (active ? toggle.active : toggle.base)
}

export const card = {
  interactive: `flex cursor-pointer items-center ${border} bg-ui-surface text-ui-text ${roundedLg} p-3 ${liftCard}`,
  panel: `flex min-h-0 flex-1 flex-col gap-3 border-2 border-ui-border bg-ui-surface p-4 shadow-[4px_4px_0px_0px_var(--ui-shadow)] ${roundedLg}`,
  header: `flex shrink-0 items-center gap-2.5 border-2 border-ui-border bg-ui-surface p-3 shadow-[3px_3px_0px_0px_var(--ui-shadow)] ${roundedMd}`,
  inset: `flex flex-col gap-2 border-2 border-ui-border bg-ui-surface p-3 shadow-[3px_3px_0px_0px_var(--ui-shadow)] ${roundedMd}`
}

export const selectRow = {
  base: `cursor-pointer border-2 border-ui-border-subtle bg-ui-surface ${roundedSm} shadow-[2px_2px_0_0_var(--ui-shadow)] transition-[box-shadow,transform] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--ui-shadow)]`,
  selected: `cursor-pointer border-2 border-creem-purple bg-creem-purple/20 ${roundedSm} shadow-[2px_2px_0_0_var(--ui-shadow)] transition-[box-shadow,transform] duration-200 hover:-translate-x-px hover:-translate-y-px hover:border-creem-purple hover:bg-creem-purple/20 hover:shadow-[3px_3px_0_0_var(--ui-shadow)]`,
  pick: (selected: boolean) => (selected ? selectRow.selected : selectRow.base)
}

export const badge = `inline-flex min-h-[26px] min-w-[26px] shrink-0 items-center justify-center px-1.5 ${border} bg-creem-purple text-creem-ink shadow-[2px_2px_0_0_var(--ui-shadow)] ${roundedSm} text-[11px] leading-none font-black tabular-nums`

// framer.css clamps every <button> to a fixed height and hides its overflow, which
// clips content-sized buttons (product rows, component cards). Apply this to those
// buttons so they grow to their content. Tailwind utilities are imported `!important`,
// so this wins over framer.css.
export const fitButton = 'h-auto overflow-visible'

export const screen = 'bg-ui-bg text-ui-text flex h-full w-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-3'

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
