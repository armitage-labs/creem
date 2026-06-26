const transition = 'transition-[box-shadow,transform] duration-200 ease-in-out'
const border = 'border-2 border-creem-ink'
const roundedSm = 'rounded-lg'
const roundedMd = 'rounded-xl'
const roundedLg = 'rounded-2xl'

const liftSm = `${transition} shadow-[2px_2px_0_0_#151617] hover:shadow-[3px_3px_0_0_#151617] hover:-translate-x-px hover:-translate-y-px active:shadow-[1px_1px_0_0_#151617] active:translate-x-px active:translate-y-px`
const liftMd = `${transition} shadow-[3px_3px_0_0_#151617] hover:shadow-[5px_5px_0_0_#151617] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-[1px_1px_0_0_#151617] active:translate-x-px active:translate-y-px`
const liftCard = `${transition} shadow-[3px_3px_0_0_#151617] hover:shadow-[5px_5px_0_0_#151617] hover:-translate-x-0.5 hover:-translate-y-0.5`

export const btn = {
  cta: `inline-flex w-full cursor-pointer items-center justify-center gap-2 ${border} bg-creem-peach text-creem-ink font-black ${roundedMd} px-4 py-3 ${liftMd} hover:bg-creem-peach hover:text-creem-ink disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-[#e8e4e1] disabled:text-gray-400 disabled:shadow-none disabled:translate-none`,
  compact: `inline-flex cursor-pointer items-center gap-1.5 ${border} bg-creem-cream text-creem-ink font-black ${roundedSm} ${liftSm} hover:bg-creem-cream hover:text-creem-ink`,
  dark: `inline-flex cursor-pointer items-center gap-1.5 ${border} bg-creem-ink text-white font-black ${roundedSm} min-h-8 px-3 ${liftSm} hover:bg-creem-ink hover:text-white`,
  logout: 'ml-auto w-[120px] text-xs',
  icon: `inline-flex size-7 shrink-0 cursor-pointer items-center justify-center p-0 ${border} bg-creem-purple text-creem-ink ${roundedSm} ${liftSm} hover:bg-creem-purple hover:text-creem-ink disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-[#e8e4e1] disabled:text-gray-400 disabled:shadow-none disabled:translate-none`,
  secondary: `inline-flex cursor-pointer items-center justify-center ${border} bg-white text-creem-ink ${roundedSm} ${liftSm} hover:bg-white hover:text-creem-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-none`,
  danger: `inline-flex cursor-pointer items-center justify-center ${border} bg-white text-red-600 ${roundedSm} ${liftSm} hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-none`,
  dashed: `inline-flex w-full cursor-pointer items-center justify-center gap-1 ${border} border-dashed bg-white text-creem-ink font-black ${roundedSm} ${liftSm} hover:bg-white hover:text-creem-ink`,
  disclosure: 'flex w-full cursor-pointer items-center justify-between border-0 bg-transparent shadow-none hover:bg-transparent',
  iconSize: 'size-7 min-h-7 min-w-7 p-0',
  iconSizeLg: 'size-8 min-h-8 min-w-8 p-0'
} as const

export const toggle = {
  base: `cursor-pointer ${border} bg-creem-cream text-creem-ink font-black ${roundedSm} ${liftSm} hover:bg-creem-cream hover:text-creem-ink`,
  active: `cursor-pointer ${border} bg-creem-purple text-creem-ink font-black ${roundedSm} ${liftSm} hover:bg-creem-purple hover:text-creem-ink`,
  segment: (active: boolean) => (active ? toggle.active : toggle.base)
}

export const card = {
  interactive: `flex cursor-pointer items-center ${border} bg-white ${roundedLg} p-3 ${liftCard}`,
  panel: `flex min-h-0 flex-1 flex-col gap-3 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000] ${roundedLg}`,
  header: `flex shrink-0 items-center gap-2.5 border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000] ${roundedMd}`,
  inset: `flex flex-col gap-2 border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000] ${roundedMd}`
}

export const selectRow = {
  base: `cursor-pointer border-2 border-gray-300 bg-white ${roundedSm} shadow-[2px_2px_0_0_#151617] transition-[box-shadow,transform] duration-200 hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#151617]`,
  selected: `cursor-pointer border-2 border-creem-purple bg-creem-purple/20 ${roundedSm} shadow-[2px_2px_0_0_#151617] transition-[box-shadow,transform] duration-200 hover:-translate-x-px hover:-translate-y-px hover:border-creem-purple hover:bg-creem-purple/20 hover:shadow-[3px_3px_0_0_#151617]`,
  pick: (selected: boolean) => (selected ? selectRow.selected : selectRow.base)
}

export const badge = `inline-flex min-h-[26px] min-w-[26px] shrink-0 items-center justify-center px-1.5 ${border} bg-creem-purple text-creem-ink shadow-[2px_2px_0_0_#151617] ${roundedSm} text-[11px] leading-none font-black tabular-nums`

export const screen = 'bg-creem-cream flex h-full w-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-3'

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
