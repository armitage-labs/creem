type FramerIconProps = {
  size?: number
  strokeWidth?: number
  className?: string
  style?: Record<string, string | number>
}

function FramerSvg({ size = 20, strokeWidth = 2, className, style, children }: FramerIconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      style={style}
      aria-hidden='true'
    >
      {children}
    </svg>
  )
}

export function Loader2({ size = 20, className, style }: FramerIconProps) {
  return (
    <FramerSvg size={size} className={className} style={style}>
      <path d='M21 12a9 9 0 1 1-6.22-8.56' />
    </FramerSvg>
  )
}

export function ArrowUpRight({ size = 20, className, style }: FramerIconProps) {
  return (
    <FramerSvg size={size} className={className} style={style}>
      <path d='M7 7h10v10' />
      <path d='M7 17 17 7' />
    </FramerSvg>
  )
}

export function FlaskConical({ size = 20, strokeWidth = 2, className, style }: FramerIconProps) {
  return (
    <FramerSvg size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <path d='M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2' />
      <path d='M6.453 15h11.094' />
      <path d='M8.5 2h7' />
    </FramerSvg>
  )
}
