export {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Image,
  Info,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Store,
  Trash2,
  X
} from 'lucide-react'

/** Tailwind size classes for the ~350px plugin panel. */
export const ICON = {
  xxs: 'h-4 w-4',
  xs: 'h-[18px] w-[18px]',
  sm: 'h-5 w-5',
  md: 'h-[22px] w-[22px]',
  lg: 'h-9 w-9',
  xl: 'h-14 w-14',
  /** Icon size for 28px square icon buttons (`btn.iconSize`) */
  btn: 'h-5 w-5',
  /** Icon size for 32px square icon buttons (`btn.iconSizeLg`) */
  btnLg: 'h-[22px] w-[22px]'
} as const

export function iconClass(size: keyof typeof ICON, ...classes: (string | false | undefined)[]) {
  return [ICON[size], ...classes.filter(Boolean)].join(' ')
}
