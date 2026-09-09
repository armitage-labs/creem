import { useState, useEffect, useCallback, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addPropertyControls, ControlType, RenderTarget } from 'framer'
import { ArrowUpRight, FlaskConical } from './icons.tsx'

function TestModeWatermark() {
  return (
    <div
      aria-hidden='true'
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        pointerEvents: 'none',
        zIndex: 2147483000,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        background: '#FFE7D6',
        border: '1px solid #FFBE98',
        color: '#8A4A26',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap'
      }}
    >
      <FlaskConical size={12} />
      Test mode
    </div>
  )
}

type Tier = {
  name: string
  price: number
  priceCents?: number | null
  currency?: string
  isOneTime?: boolean
  description: string
  productId: string
  billingPeriod?: string
  ctaText: string
  ctaVariant: 'default' | 'outline' | 'ghost' | 'gradient' | 'shadow' | 'shimmer' | 'icon-slide'
  ctaBackground?: string
  ctaTextColor?: string
  highlighted: boolean
}

// Recurring billing intervals ordered shortest→longest, with tab labels.
const INTERVAL_ORDER = ['every-day', 'every-month', 'every-three-months', 'every-six-months', 'every-year']
const INTERVAL_LABEL: Record<string, string> = {
  'every-day': 'Daily',
  'every-month': 'Monthly',
  'every-three-months': 'Quarterly',
  'every-six-months': 'Semi-annual',
  'every-year': 'Yearly'
}

// Demo/placeholder product ids that ship as control defaults (or the built-in
// DEFAULT_TIERS). A CTA pointing at one of these would open a broken checkout,
// so we block it and surface a message instead (see handleCheckout).
const PLACEHOLDER_PRODUCT_IDS = new Set(['prod_abc123', 'prod_free', 'prod_premium', 'prod_enterprise', 'prod_YOUR_PRODUCT_ID'])

function formatTierAmount(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined) return '—'
  if (cents === 0) return 'Free'
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency
    })
    const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2
    return formatter.format(cents / 10 ** exponent)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function resolveTierPriceCents(tier: Tier): number | null {
  return tier.priceCents ?? (Number.isFinite(tier.price) ? Math.round(tier.price * 100) : null)
}

function resolveBillingPeriodLabel(billingPeriod?: string): string | null {
  switch (billingPeriod) {
    case 'every-month':
      return 'month'
    case 'every-year':
      return 'year'
    case 'every-three-months':
      return '3 months'
    case 'every-six-months':
      return '6 months'
    case 'every-day':
      return 'day'
    default:
      return null
  }
}

function resolveTierPeriod(tier: Tier): string | null {
  if (tier.isOneTime || tier.billingPeriod === 'once') return null
  return resolveBillingPeriodLabel(tier.billingPeriod)
}

function buildCreemCheckoutUrl(productId: string, testMode: boolean): string {
  const base = testMode ? 'https://creem.io/test/payment' : 'https://creem.io/payment'
  return `${base}/${productId}`
}

/** Treat Framer's cleared/transparent optional colors as unset. */
function resolveOptionalColor(value: string | undefined | null): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'transparent') return undefined
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed) && trimmed.slice(7, 9).toLowerCase() === '00') return undefined
  return trimmed
}

const SAFE_HREF = /^(https?:\/\/|mailto:)/i
const INLINE_MD = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g

function renderInlineMarkdown(text: string, keyPrefix: string, styles: { fontSize: number; color: string; headingColor: string; linkColor: string }): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let i = 0
  let match: RegExpExecArray | null
  INLINE_MD.lastIndex = 0
  while ((match = INLINE_MD.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${i++}`
    const [, linkText, href, boldA, boldB, italA, italB, code] = match
    if (linkText !== undefined) {
      nodes.push(
        SAFE_HREF.test(href) ? (
          <a key={key} href={href} target='_blank' rel='noopener noreferrer' style={{ color: styles.linkColor, fontWeight: 600, textDecoration: 'underline' }}>
            {linkText}
          </a>
        ) : (
          linkText
        )
      )
    } else if (boldA !== undefined || boldB !== undefined) {
      nodes.push(
        <strong key={key} style={{ color: styles.headingColor, fontWeight: 700 }}>
          {boldA ?? boldB}
        </strong>
      )
    } else if (italA !== undefined || italB !== undefined) {
      nodes.push(<em key={key}>{italA ?? italB}</em>)
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={key}
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: styles.fontSize * 0.9,
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 4,
            padding: '1px 4px'
          }}
        >
          {code}
        </code>
      )
    }
    lastIndex = INLINE_MD.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function TierDescriptionMarkdown({ text, fontSize, color, headingColor, linkColor }: { text: string; fontSize: number; color: string; headingColor: string; linkColor: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let key = 0
  let i = 0
  const inlineStyles = { fontSize, color, headingColor, linkColor }
  const flushParagraph = () => {
    if (para.length === 0) return
    blocks.push(
      <p key={`p-${key++}`} style={{ margin: 0, lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {renderInlineMarkdown(para.join(' '), `p${key}`, inlineStyles)}
      </p>
    )
    para = []
  }
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      flushParagraph()
      i++
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      const headingSize = level <= 2 ? fontSize : Math.round(fontSize * 0.93)
      blocks.push(
        <p
          key={`h-${key++}`}
          style={{
            margin: 0,
            fontSize: headingSize,
            fontWeight: 700,
            color: headingColor,
            lineHeight: 1.3,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere'
          }}
        >
          {renderInlineMarkdown(heading[2], `h${key}`, inlineStyles)}
        </p>
      )
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul
          key={`ul-${key++}`}
          style={{
            margin: 0,
            paddingLeft: fontSize * 1.2,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            listStyleType: 'disc'
          }}
        >
          {items.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {renderInlineMarkdown(item, `ul${key}-${idx}`, inlineStyles)}
            </li>
          ))}
        </ul>
      )
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol
          key={`ol-${key++}`}
          style={{
            margin: 0,
            paddingLeft: fontSize * 1.2,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            listStyleType: 'decimal'
          }}
        >
          {items.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {renderInlineMarkdown(item, `ol${key}-${idx}`, inlineStyles)}
            </li>
          ))}
        </ol>
      )
      continue
    }
    para.push(line)
    i++
  }
  flushParagraph()
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize, color }}>{blocks}</div>
}

function CheckoutEmbedModal({ url, onClose }: { url: string; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box'
      }}
    >
      <button
        type='button'
        aria-hidden='true'
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          background: 'rgba(0, 0, 0, 0.6)',
          cursor: 'pointer',
          padding: 0
        }}
      />
      <div
        style={{
          position: 'relative',
          width: 'min(480px, 100%)',
          height: 'min(720px, calc(100vh - 32px))',
          background: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <span tabIndex={0} onFocus={() => iframeRef.current?.focus()} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #e5e5e5',
            background: '#fff',
            flexShrink: 0
          }}
        >
          <span id={titleId} style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
            Checkout
          </span>
          <button
            ref={closeButtonRef}
            type='button'
            onClick={onClose}
            aria-label='Close checkout'
            style={{
              border: 'none',
              background: '#f3f3f3',
              color: '#111',
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
        <iframe ref={iframeRef} src={url} title='Creem checkout' style={{ width: '100%', flex: 1, border: 'none', display: 'block' }} allow='payment *' />
        <span tabIndex={0} onFocus={() => closeButtonRef.current?.focus()} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }} />
      </div>
    </div>,
    document.body
  )
}

type Props = {
  type?: 'embed' | 'new-tab'
  testMode?: boolean
  table?: {
    pageBackground?: string
    layout?: 'vertical' | 'grid' | 'horizontal'
    gridColumns?: number
    minCardWidth?: number
    maxWidth?: number
    gridGap?: number
  }
  header?: {
    showHeader?: boolean
    headerTitle?: string
    headerDescription?: string
    headerAlignment?: 'left' | 'center' | 'right'
    headerTitleFontSize?: number
    headerDescriptionFontSize?: number
    headerTitleColor?: string
    headerDescriptionColor?: string
  }
  tiers?: Tier[]
  billingToggle?: {
    showIntervalTabs?: boolean
    toggleStyle?: 'pill' | 'segmented'
    toggleBackground?: string
    toggleBorderColor?: string
    toggleActiveBackground?: string
    toggleActiveTextColor?: string
    toggleTextColor?: string
  }
  card?: {
    cardBackground?: string
    borderColor?: string
    dividerColor?: string
    cardRadius?: number
    cardBorderWidth?: number
    cardPadding?: number
    cardGap?: number
    textColor?: string
    mutedTextColor?: string
    accentColor?: string
    titleFontSize?: number
    descriptionFontSize?: number
    priceFontSize?: number
  }
  featured?: {
    primaryButtonBackground?: string
    primaryButtonTextColor?: string
    featuredBorderColor?: string
    featuredCardBorderWidth?: number
  }
  standardButton?: {
    secondaryButtonBackground?: string
    secondaryButtonTextColor?: string
    buttonBorderColor?: string
    buttonHeight?: number
    buttonRadius?: number
    buttonFontSize?: number
  }
}

const DEFAULT_TIERS: Tier[] = [
  {
    name: 'Free',
    price: 0,
    billingPeriod: 'every-month',
    description: 'Recommended for people with at least 1 year experience in crypto markets.',
    productId: 'prod_free',
    ctaText: 'Free plan',
    ctaVariant: 'default',
    highlighted: false
  },
  {
    name: 'Premium',
    price: 99,
    billingPeriod: 'every-month',
    description: 'Everything in the Basic Plan plus advanced search, better analytics.',
    productId: 'prod_premium',
    ctaText: 'Purchase plan',
    ctaVariant: 'default',
    highlighted: true
  },
  {
    name: 'Enterprise',
    price: 299,
    billingPeriod: 'every-month',
    description: 'Includes all Professional Plan features plus full logistics automation etc.',
    productId: 'prod_enterprise',
    ctaText: 'Purchase plan',
    ctaVariant: 'default',
    highlighted: false
  }
]

export function CreemPricingTable({
  type = 'embed',
  testMode = false,
  table: { pageBackground = 'transparent', layout = 'grid', gridColumns = 3, minCardWidth = 300, maxWidth = 1200, gridGap = 22 } = {},
  header: {
    showHeader = true,
    headerTitle = 'Monetize Your Framer Projects',
    headerDescription = 'Launch subscriptions, one-time payments, and billing portals in minutes - no backend needed.',
    headerAlignment = 'center',
    headerTitleFontSize = 48,
    headerDescriptionFontSize = 18,
    headerTitleColor = '#000000',
    headerDescriptionColor = '#9CA3AF'
  } = {},
  tiers = DEFAULT_TIERS,
  billingToggle: {
    showIntervalTabs = true,
    toggleStyle = 'pill',
    toggleBackground = '#FFFFFF',
    toggleBorderColor = '#E6E6E6',
    toggleActiveBackground = '#111111',
    toggleActiveTextColor = '#FFFFFF',
    toggleTextColor = '#111111'
  } = {},
  card: {
    cardBackground = '#FFFFFF',
    borderColor = '#E6E6E6',
    dividerColor = '#EDEDED',
    cardRadius = 14,
    cardBorderWidth = 2,
    cardPadding = 26,
    cardGap = 18,
    textColor = '#000000',
    mutedTextColor = '#7A7A7A',
    accentColor = '#111111',
    titleFontSize = 28,
    descriptionFontSize = 14,
    priceFontSize = 56
  } = {},
  featured: { primaryButtonBackground = '#111111', primaryButtonTextColor = '#FFFFFF', featuredBorderColor = '#111111', featuredCardBorderWidth = 2 } = {},
  standardButton: {
    secondaryButtonBackground = '#EDEDED',
    secondaryButtonTextColor = '#000000',
    buttonBorderColor = '#E1E1E1',
    buttonHeight = 44,
    buttonRadius = 8,
    buttonFontSize = 15
  } = {}
}: Props) {
  const intervalsPresent = INTERVAL_ORDER.filter(iv => tiers.some(t => !t.isOneTime && t.billingPeriod === iv))
  const [activeInterval, setActiveInterval] = useState('')
  // Default to the interval that holds the featured tier so the highlighted card
  // is visible on first paint — otherwise it may live in a non-default tab and
  // render hidden until the visitor switches intervals.
  const featuredInterval = tiers.find(t => t.highlighted && !t.isOneTime && t.billingPeriod && intervalsPresent.includes(t.billingPeriod))?.billingPeriod
  const effectiveInterval = intervalsPresent.includes(activeInterval) ? activeInterval : (featuredInterval ?? intervalsPresent[0] ?? '')
  const showTabs = showIntervalTabs && intervalsPresent.length >= 2
  const visibleTiers = showTabs ? tiers.filter(t => t.isOneTime || t.billingPeriod === 'once' || t.billingPeriod === effectiveInterval) : tiers
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const isCanvas = RenderTarget.current() === RenderTarget.canvas
  const closeEmbed = useCallback(() => {
    setEmbedUrl(null)
  }, [])

  // Responsive breakpoint detection with resize listener
  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width < 480) setBreakpoint('mobile')
      else if (width < 1024) setBreakpoint('tablet')
      else setBreakpoint('desktop')
    }
    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  // Responsive spacing using user-defined values
  const getResponsiveSpacing = () => {
    if (breakpoint === 'mobile')
      return {
        padding: `${Math.round(cardPadding * 0.75)}px ${Math.round(cardPadding * 0.6)}px`,
        gap: Math.round(gridGap * 0.7),
        cardPadding: `${Math.round(cardPadding * 0.75)}px ${Math.round(cardPadding * 0.6)}px`
      }
    if (breakpoint === 'tablet')
      return {
        padding: `${Math.round(cardPadding * 0.85)}px ${Math.round(cardPadding * 0.75)}px`,
        gap: Math.round(gridGap * 0.85),
        cardPadding: `${Math.round(cardPadding * 0.85)}px ${Math.round(cardPadding * 0.75)}px`
      }
    return {
      padding: `${cardPadding}px ${Math.round(cardPadding * 0.75)}px`,
      gap: gridGap,
      cardPadding: `${cardPadding}px ${Math.round(cardPadding * 0.9)}px`
    }
  }
  const spacing = getResponsiveSpacing()

  // Responsive font sizes using user-defined values
  const getFontSizes = () => {
    if (breakpoint === 'mobile')
      return {
        title: Math.round(titleFontSize * 0.85),
        price: Math.round(priceFontSize * 0.85),
        description: Math.round(descriptionFontSize * 0.93),
        cta: Math.round(buttonFontSize * 0.93)
      }
    if (breakpoint === 'tablet')
      return {
        title: Math.round(titleFontSize * 0.93),
        price: Math.round(priceFontSize * 0.93),
        description: Math.round(descriptionFontSize * 0.96),
        cta: Math.round(buttonFontSize * 0.96)
      }
    return {
      title: titleFontSize,
      price: priceFontSize,
      description: descriptionFontSize,
      cta: buttonFontSize
    }
  }
  const fonts = getFontSizes()

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transitionDuration = prefersReducedMotion ? '0s' : '0.3s'
  const handleCheckout = (tier: Tier) => {
    if (isCanvas) return
    const productId = tier.productId?.trim()
    // Guard against unconfigured tiers — an empty or still-placeholder product id
    // would open a broken Creem checkout. Surface a message instead of navigating.
    if (!productId || PLACEHOLDER_PRODUCT_IDS.has(productId)) {
      setCheckoutError(`“${tier.name}” isn’t available yet — the site owner still needs to connect it to a Creem product.`)
      return
    }
    setCheckoutError(null)
    const url = buildCreemCheckoutUrl(productId, testMode)
    if (type === 'embed') {
      setEmbedUrl(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
  const effectiveGridColumns = layout === 'grid' ? Math.max(1, Math.min(5, Math.round(gridColumns) || 3)) : 1
  const cardsLayoutStyle: React.CSSProperties =
    layout === 'vertical'
      ? {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: spacing.gap,
          width: '100%'
        }
      : layout === 'horizontal'
        ? {
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            justifyContent: 'flex-start',
            gap: spacing.gap,
            width: '100%',
            overflowX: 'auto',
            paddingBottom: 8,
            scrollSnapType: 'x mandatory'
          }
        : {
            display: 'grid',
            gridTemplateColumns: breakpoint === 'mobile' ? 'minmax(0, 1fr)' : `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
            gap: spacing.gap,
            width: '100%',
            // Cap the grid width so the author's column count acts as a MAX: N columns of minCardWidth + (N-1) gaps.
            maxWidth: breakpoint === 'mobile' ? '100%' : effectiveGridColumns * minCardWidth + (effectiveGridColumns - 1) * spacing.gap,
            marginLeft: 'auto',
            marginRight: 'auto',
            justifyItems: 'stretch'
          }
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100%',
        background: pageBackground,
        display: 'flex',
        justifyContent: 'center',
        fontFamily: 'inherit',
        padding: spacing.padding,
        boxSizing: 'border-box'
      }}
    >
      {testMode && <TestModeWatermark />}
      {/* ARIA live region for interval changes */}
      <div
        aria-live='polite'
        aria-atomic='true'
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        {showTabs && `Billing interval: ${INTERVAL_LABEL[effectiveInterval] ?? ''}`}
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: maxWidth,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          boxSizing: 'border-box'
        }}
      >
        {/* Header Title & Description */}
        {showHeader && (
          <div
            style={{
              width: '100%',
              marginBottom: 40,
              textAlign: headerAlignment
            }}
          >
            {headerTitle && (
              <h2
                style={{
                  fontSize: headerTitleFontSize,
                  fontWeight: 700,
                  color: headerTitleColor,
                  margin: 0,
                  marginBottom: headerDescription ? 12 : 0,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em'
                }}
              >
                {headerTitle}
              </h2>
            )}
            {headerDescription && (
              <p
                style={{
                  fontSize: headerDescriptionFontSize,
                  color: headerDescriptionColor,
                  margin: 0,
                  lineHeight: 1.6,
                  maxWidth: 600,
                  marginLeft: headerAlignment === 'center' ? 'auto' : 0,
                  marginRight: headerAlignment === 'center' ? 'auto' : 0
                }}
              >
                {headerDescription}
              </p>
            )}
          </div>
        )}
        {/* Interval Tabs */}
        {showTabs && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'center',
              gap: 12,
              marginBottom: 32,
              background: toggleBackground,
              border: `2px solid ${toggleBorderColor}`,
              borderRadius: toggleStyle === 'pill' ? 999 : 10,
              padding: 4,
              position: 'relative'
            }}
            role='group'
            aria-label='Billing interval selector'
          >
            {intervalsPresent.map(iv => {
              const active = iv === effectiveInterval
              return (
                <button
                  key={iv}
                  onClick={() => {
                    if (isCanvas) return
                    setCheckoutError(null)
                    setActiveInterval(iv)
                  }}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isCanvas) {
                      e.preventDefault()
                      setCheckoutError(null)
                      setActiveInterval(iv)
                    }
                  }}
                  disabled={isCanvas}
                  aria-pressed={active}
                  type='button'
                  role='button'
                  style={{
                    height: 38,
                    padding: '0 20px',
                    minWidth: 80,
                    borderRadius: toggleStyle === 'pill' ? 999 : 8,
                    fontSize: breakpoint === 'mobile' ? 13 : 14,
                    fontWeight: 600,
                    border: 'none',
                    cursor: isCanvas ? 'default' : 'pointer',
                    transition: `all ${transitionDuration}`,
                    background: active ? toggleActiveBackground : 'transparent',
                    color: active ? toggleActiveTextColor : toggleTextColor,
                    outline: 'none',
                    userSelect: 'none',
                    whiteSpace: 'nowrap'
                  }}
                  onFocus={e => {
                    if (!isCanvas) {
                      e.currentTarget.style.outline = `2px solid ${toggleActiveBackground}`
                      e.currentTarget.style.outlineOffset = '2px'
                    }
                  }}
                  onBlur={e => {
                    e.currentTarget.style.outline = 'none'
                  }}
                >
                  {INTERVAL_LABEL[iv] ?? iv}
                </button>
              )
            })}
          </div>
        )}
        {/* Checkout guard message — shown when a CTA points at an unconfigured tier. */}
        {checkoutError && (
          <div
            role='alert'
            style={{
              alignSelf: 'stretch',
              marginBottom: 24,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #F5C2C7',
              background: '#FDECEE',
              color: '#842029',
              fontSize: 14,
              lineHeight: 1.5,
              textAlign: 'center'
            }}
          >
            {checkoutError}
          </div>
        )}
        {/* Pricing Cards */}
        <div style={{ ...cardsLayoutStyle, alignSelf: 'stretch' }}>
          {visibleTiers.map((tier, idx) => {
            const currency = tier.currency || 'USD'
            const period = resolveTierPeriod(tier)
            const priceCents = resolveTierPriceCents(tier)
            const formattedPrice = formatTierAmount(priceCents, currency)
            const buttonBg = resolveOptionalColor(tier.ctaBackground) ?? (tier.highlighted ? primaryButtonBackground : secondaryButtonBackground)
            const buttonColor = resolveOptionalColor(tier.ctaTextColor) ?? (tier.highlighted ? primaryButtonTextColor : secondaryButtonTextColor)

            // Get variant-specific button styles
            const getButtonVariantStyles = (): React.CSSProperties => {
              const baseStyles: React.CSSProperties = {
                width: '100%',
                padding: breakpoint === 'mobile' ? '12px 20px' : '14px 24px',
                minHeight: buttonHeight,
                borderRadius: buttonRadius,
                fontSize: fonts.cta,
                fontWeight: 600,
                cursor: isCanvas ? 'default' : 'pointer',
                transition: prefersReducedMotion ? 'none' : 'all 0.3s ease',
                marginBottom: 24,
                outline: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                position: 'relative',
                overflow: 'hidden'
              }
              switch (tier.ctaVariant) {
                case 'outline':
                  return {
                    ...baseStyles,
                    background: 'transparent',
                    color: buttonBg,
                    border: `2px solid ${buttonBg}`
                  }
                case 'ghost':
                  return {
                    ...baseStyles,
                    background: 'transparent',
                    color: buttonBg,
                    border: 'none'
                  }
                case 'gradient':
                  return {
                    ...baseStyles,
                    background: `linear-gradient(135deg, ${buttonBg} 0%, color-mix(in srgb, ${buttonBg}, black 20%) 100%)`,
                    color: buttonColor,
                    border: 'none'
                  }
                case 'shadow':
                  return {
                    ...baseStyles,
                    background: buttonBg,
                    color: buttonColor,
                    border: 'none',
                    boxShadow: `0 4px 14px 0 color-mix(in srgb, ${buttonBg} 30%, transparent), 0 10px 20px 0 color-mix(in srgb, ${buttonBg} 20%, transparent)`
                  }
                case 'shimmer':
                  return {
                    ...baseStyles,
                    background: `linear-gradient(110deg, ${buttonBg} 0%, color-mix(in srgb, ${buttonBg}, white 20%) 50%, ${buttonBg} 100%)`,
                    backgroundSize: '200% 100%',
                    color: buttonColor,
                    border: 'none'
                  }
                case 'icon-slide':
                  return {
                    ...baseStyles,
                    background: buttonBg,
                    color: buttonColor,
                    border: 'none',
                    borderRadius: 9999,
                    paddingRight: breakpoint === 'mobile' ? '52px' : '60px'
                  }
                default:
                  return {
                    ...baseStyles,
                    background: buttonBg,
                    color: buttonColor,
                    border: tier.highlighted ? 'none' : `1px solid ${buttonBorderColor}`
                  }
              }
            }

            // Check if this is the last card and if it should take full width
            // Only apply full width on tablet when odd number of cards
            const isLastCard = idx === visibleTiers.length - 1
            const shouldTakeFullWidth = layout !== 'grid' && isLastCard && breakpoint === 'tablet' && visibleTiers.length % 2 !== 0
            const cardStyle: React.CSSProperties = {
              position: 'relative',
              background: cardBackground,
              border: tier.highlighted ? `${featuredCardBorderWidth}px solid ${featuredBorderColor}` : `${cardBorderWidth}px solid ${borderColor}`,
              borderRadius: cardRadius,
              padding: spacing.cardPadding,
              // Grid layout: each card is a subgrid sharing the parent's row tracks, so every
              // section (title, price, CTA, description) aligns across cards regardless of title length.
              // Other layouts keep the simple flex column.
              display: layout === 'grid' ? 'grid' : 'flex',
              flexDirection: layout === 'grid' ? undefined : 'column',
              gridTemplateRows: layout === 'grid' ? 'subgrid' : undefined,
              gridRow: layout === 'grid' ? 'span 4' : undefined,
              gap: cardGap,
              boxShadow: tier.highlighted ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
              transition: prefersReducedMotion ? 'none' : 'all 0.3s ease',
              boxSizing: 'border-box',
              overflow: layout === 'grid' ? 'hidden' : undefined,
              scrollSnapAlign: layout === 'horizontal' ? 'start' : undefined,
              flexShrink: layout === 'horizontal' ? 0 : undefined,
              flex:
                layout === 'grid'
                  ? undefined
                  : layout === 'horizontal'
                    ? `0 0 ${minCardWidth}px`
                    : layout === 'vertical'
                      ? '1 1 auto'
                      : breakpoint === 'mobile'
                        ? '1 1 100%'
                        : shouldTakeFullWidth
                          ? '1 1 100%'
                          : undefined,
              width: layout === 'grid' ? '100%' : undefined,
              minWidth:
                layout === 'grid'
                  ? breakpoint === 'mobile'
                    ? 0
                    : `${minCardWidth}px`
                  : layout === 'horizontal'
                    ? `${minCardWidth}px`
                    : breakpoint === 'mobile'
                      ? '100%'
                      : shouldTakeFullWidth
                        ? '100%'
                        : `${minCardWidth}px`,
              maxWidth:
                layout === 'grid'
                  ? '100%'
                  : layout === 'horizontal'
                    ? `${Math.min(minCardWidth + 80, 420)}px`
                    : breakpoint === 'mobile'
                      ? '100%'
                      : shouldTakeFullWidth
                        ? '100%'
                        : `${Math.min(minCardWidth + 80, 420)}px`
            }
            return (
              <div key={idx} style={cardStyle}>
                {/* Tier Name */}
                <h3
                  style={{
                    fontSize: fonts.title,
                    fontWeight: 700,
                    color: textColor,
                    margin: '0 0 12px 0',
                    lineHeight: 1.2,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {tier.name}
                </h3>
                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 0 24px 0', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: fonts.price,
                      fontWeight: 700,
                      color: textColor,
                      lineHeight: 1,
                      letterSpacing: '-0.02em'
                    }}
                  >
                    {formattedPrice}
                  </span>
                  {period && priceCents !== 0 && <span style={{ fontSize: fonts.price * 0.29, color: mutedTextColor, fontWeight: 500 }}>/{period}</span>}
                </div>
                {/* CTA Button */}
                <style>{`
                  .pricing-btn-shimmer-${idx} {
                    animation: shimmer-${idx} 2s linear infinite;
                  }
                  @keyframes shimmer-${idx} {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                  .pricing-icon-circle-${idx} {
                    position: absolute;
                    right: ${breakpoint === 'mobile' ? '8px' : '10px'};
                    width: ${buttonHeight * 0.6}px;
                    height: ${buttonHeight * 0.6}px;
                    background: ${buttonColor === '#FFFFFF' ? '#000000' : '#FFFFFF'};
                    color: ${buttonColor === '#FFFFFF' ? '#FFFFFF' : '#000000'};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                  }
                  .pricing-btn-icon-slide-${idx}:hover .pricing-icon-circle-${idx} {
                    right: calc(100% - ${buttonHeight * 0.6 + (breakpoint === 'mobile' ? 8 : 10)}px);
                    transform: rotate(45deg);
                  }
                `}</style>
                <button
                  onClick={() => handleCheckout(tier)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isCanvas) {
                      e.preventDefault()
                      handleCheckout(tier)
                    }
                  }}
                  disabled={isCanvas}
                  aria-label={`${tier.ctaText} - ${tier.name} plan for ${formattedPrice}${period && priceCents !== 0 ? `/${period}` : ''}`}
                  aria-disabled={isCanvas}
                  type='button'
                  className={`${tier.ctaVariant === 'shimmer' ? `pricing-btn-shimmer-${idx}` : ''} ${tier.ctaVariant === 'icon-slide' ? `pricing-btn-icon-slide-${idx}` : ''}`}
                  style={getButtonVariantStyles()}
                  onMouseEnter={e => {
                    if (!isCanvas && !prefersReducedMotion && tier.ctaVariant !== 'shimmer') {
                      e.currentTarget.style.opacity = '0.85'
                      if (tier.ctaVariant === 'ghost') e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isCanvas && !prefersReducedMotion) {
                      e.currentTarget.style.opacity = '1'
                      if (tier.ctaVariant === 'ghost') e.currentTarget.style.background = 'transparent'
                    }
                  }}
                  onFocus={e => {
                    if (!isCanvas) {
                      e.currentTarget.style.outline = `2px solid ${tier.highlighted ? primaryButtonBackground : secondaryButtonBackground}`
                      e.currentTarget.style.outlineOffset = '2px'
                    }
                  }}
                  onBlur={e => {
                    e.currentTarget.style.outline = 'none'
                  }}
                >
                  {tier.ctaText}
                  {tier.ctaVariant === 'icon-slide' && (
                    <div className={`pricing-icon-circle-${idx}`}>
                      <ArrowUpRight size={buttonHeight * 0.35} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
                {/* Separator + Description grouped into one subgrid row so the description aligns across cards. */}
                <div style={layout === 'grid' ? { display: 'flex', flexDirection: 'column', minHeight: 0 } : { display: 'contents' }}>
                  {/* Separator */}
                  <div
                    style={{
                      width: '100%',
                      height: 1,
                      background: dividerColor,
                      margin: '0 0 24px 0'
                    }}
                  />
                  {/* Description */}
                  <div
                    style={{
                      flex: 1,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    <TierDescriptionMarkdown text={tier.description} fontSize={fonts.description} color={mutedTextColor} headingColor={textColor} linkColor={accentColor} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {embedUrl && <CheckoutEmbedModal url={embedUrl} onClose={closeEmbed} />}
    </div>
  )
}

// ─── Defaults & Controls ──────────────────────────────────────────────────────

addPropertyControls(CreemPricingTable, {
  type: {
    type: ControlType.Enum,
    title: 'Checkout Type',
    options: ['embed', 'new-tab'],
    optionTitles: ['Embed', 'New Tab'],
    defaultValue: 'embed',
    description: 'How to open checkout'
  },
  testMode: {
    type: ControlType.Boolean,
    title: 'Test Mode',
    defaultValue: false,
    enabledTitle: 'On',
    disabledTitle: 'Off',
    // Set automatically at insert time to match the synced products' environment; hidden because
    // flipping it can't remap product IDs between test/live (see tracker OSS-22).
    hidden: () => true
  },

  table: {
    type: ControlType.Object,
    title: 'Table',
    controls: {
      pageBackground: {
        type: ControlType.Color,
        title: 'Page Background',
        defaultValue: 'transparent'
      },
      layout: {
        type: ControlType.Enum,
        title: 'Layout',
        options: ['grid', 'horizontal', 'vertical'],
        optionTitles: ['Grid', 'Horizontal', 'Vertical'],
        defaultValue: 'grid'
      },
      gridColumns: {
        type: ControlType.Number,
        title: 'Grid Columns',
        defaultValue: 3,
        min: 1,
        max: 5,
        step: 1,
        displayStepper: true,
        hidden: (props: any) => props.layout !== 'grid'
      },
      minCardWidth: {
        type: ControlType.Number,
        title: 'Min Card Width',
        defaultValue: 300,
        min: 200,
        max: 520,
        step: 10,
        unit: 'px',
        displayStepper: true
      },
      maxWidth: {
        type: ControlType.Number,
        title: 'Max Width',
        min: 800,
        max: 1600,
        step: 50,
        defaultValue: 1200,
        unit: 'px',
        displayStepper: true
      },
      gridGap: {
        type: ControlType.Number,
        title: 'Grid Gap',
        defaultValue: 22,
        min: 8,
        max: 60,
        step: 1,
        unit: 'px',
        displayStepper: true
      }
    }
  },

  header: {
    type: ControlType.Object,
    title: 'Header',
    controls: {
      showHeader: {
        type: ControlType.Boolean,
        title: 'Show',
        defaultValue: true,
        enabledTitle: 'Yes',
        disabledTitle: 'No'
      },
      headerTitle: {
        type: ControlType.String,
        title: 'Title',
        defaultValue: 'Monetize Your Framer Projects',
        hidden: (props: any) => !props.showHeader
      },
      headerDescription: {
        type: ControlType.String,
        title: 'Description',
        defaultValue: 'Launch subscriptions, one-time payments, and billing portals in minutes - no backend needed.',
        displayTextArea: true,
        hidden: (props: any) => !props.showHeader
      },
      headerAlignment: {
        type: ControlType.Enum,
        title: 'Alignment',
        options: ['left', 'center', 'right'],
        optionTitles: ['Left', 'Center', 'Right'],
        defaultValue: 'center',
        hidden: (props: any) => !props.showHeader
      },
      headerTitleFontSize: {
        type: ControlType.Number,
        title: 'Title Size',
        defaultValue: 48,
        min: 24,
        max: 80,
        step: 2,
        unit: 'px',
        displayStepper: true,
        hidden: (props: any) => !props.showHeader
      },
      headerDescriptionFontSize: {
        type: ControlType.Number,
        title: 'Description Size',
        defaultValue: 18,
        min: 12,
        max: 28,
        step: 1,
        unit: 'px',
        displayStepper: true,
        hidden: (props: any) => !props.showHeader
      },
      headerTitleColor: {
        type: ControlType.Color,
        title: 'Title Color',
        defaultValue: '#000000',
        hidden: (props: any) => !props.showHeader
      },
      headerDescriptionColor: {
        type: ControlType.Color,
        title: 'Description Color',
        defaultValue: '#9CA3AF',
        hidden: (props: any) => !props.showHeader
      }
    }
  },

  // Pricing Tiers
  tiers: {
    type: ControlType.Array,
    title: 'Pricing Tiers',
    control: {
      type: ControlType.Object,
      title: 'Tier',
      controls: {
        name: { type: ControlType.String, title: 'Name', defaultValue: 'Premium' },
        price: { type: ControlType.Number, title: 'Price', min: 0, defaultValue: 99, step: 1 },
        description: {
          type: ControlType.String,
          title: 'Description',
          defaultValue: 'Perfect for growing teams',
          displayTextArea: true
        },
        productId: { type: ControlType.String, title: 'Product ID', defaultValue: 'prod_abc123' },
        isOneTime: {
          type: ControlType.Boolean,
          title: 'One-time Purchase',
          defaultValue: false,
          enabledTitle: 'Yes',
          disabledTitle: 'No'
        },
        billingPeriod: {
          type: ControlType.Enum,
          title: 'Billing Period',
          options: ['once', 'every-month', 'every-three-months', 'every-six-months', 'every-year', 'every-day'],
          optionTitles: ['One-time', 'Monthly', '3 Months', '6 Months', 'Yearly', 'Daily'],
          defaultValue: 'once'
        },
        currency: {
          type: ControlType.String,
          title: 'Currency',
          defaultValue: 'USD'
        },
        ctaText: { type: ControlType.String, title: 'Button Text', defaultValue: 'Purchase plan' },
        ctaVariant: {
          type: ControlType.Enum,
          title: 'Button Variant',
          options: ['default', 'outline', 'ghost', 'gradient', 'shadow', 'shimmer', 'icon-slide'],
          optionTitles: ['Default', 'Outline', 'Ghost', 'Gradient', 'Shadow', 'Shimmer', 'Icon Slide'],
          defaultValue: 'default',
          description: 'Button style variant'
        },
        ctaBackground: {
          type: ControlType.Color,
          title: 'Button BG (Optional)',
          optional: true,
          description: 'Leave empty to use default'
        },
        ctaTextColor: {
          type: ControlType.Color,
          title: 'Button Text (Optional)',
          optional: true,
          description: 'Leave empty to use default'
        },
        highlighted: {
          type: ControlType.Boolean,
          title: 'Featured',
          defaultValue: false,
          enabledTitle: 'Yes',
          disabledTitle: 'No'
        }
      }
    }
  },

  billingToggle: {
    type: ControlType.Object,
    title: 'Billing Toggle',
    controls: {
      showIntervalTabs: {
        type: ControlType.Boolean,
        title: 'Show Interval Tabs',
        defaultValue: true,
        enabledTitle: 'Show',
        disabledTitle: 'Hide'
      },
      toggleStyle: {
        type: ControlType.Enum,
        title: 'Style',
        options: ['pill', 'segmented'],
        optionTitles: ['Pill', 'Segmented'],
        defaultValue: 'pill',
        displaySegmentedControl: true,
        hidden: (props: any) => !props.showIntervalTabs
      },
      toggleBackground: {
        type: ControlType.Color,
        title: 'Background',
        defaultValue: '#FFFFFF',
        hidden: (props: any) => !props.showIntervalTabs
      },
      toggleBorderColor: {
        type: ControlType.Color,
        title: 'Border',
        defaultValue: '#E6E6E6',
        hidden: (props: any) => !props.showIntervalTabs
      },
      toggleActiveBackground: {
        type: ControlType.Color,
        title: 'Active BG',
        defaultValue: '#111111',
        hidden: (props: any) => !props.showIntervalTabs
      },
      toggleActiveTextColor: {
        type: ControlType.Color,
        title: 'Active Text',
        defaultValue: '#FFFFFF',
        hidden: (props: any) => !props.showIntervalTabs
      },
      toggleTextColor: {
        type: ControlType.Color,
        title: 'Text',
        defaultValue: '#111111',
        hidden: (props: any) => !props.showIntervalTabs
      }
    }
  },

  card: {
    type: ControlType.Object,
    title: 'Card',
    controls: {
      cardBackground: {
        type: ControlType.Color,
        title: 'Background',
        defaultValue: '#FFFFFF'
      },
      borderColor: {
        type: ControlType.Color,
        title: 'Border Color',
        defaultValue: '#E6E6E6'
      },
      dividerColor: {
        type: ControlType.Color,
        title: 'Divider Color',
        defaultValue: '#EDEDED'
      },
      cardRadius: {
        type: ControlType.Number,
        title: 'Radius',
        defaultValue: 14,
        min: 0,
        max: 40,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      cardBorderWidth: {
        type: ControlType.Number,
        title: 'Border Width',
        defaultValue: 2,
        min: 0,
        max: 8,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      cardPadding: {
        type: ControlType.Number,
        title: 'Padding',
        defaultValue: 26,
        min: 10,
        max: 60,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      cardGap: {
        type: ControlType.Number,
        title: 'Gap',
        defaultValue: 18,
        min: 8,
        max: 40,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      textColor: {
        type: ControlType.Color,
        title: 'Text Color',
        defaultValue: '#000000'
      },
      mutedTextColor: {
        type: ControlType.Color,
        title: 'Muted Text',
        defaultValue: '#7A7A7A'
      },
      accentColor: {
        type: ControlType.Color,
        title: 'Link Color',
        description: 'Color of links in tier descriptions',
        defaultValue: '#111111'
      },
      titleFontSize: {
        type: ControlType.Number,
        title: 'Title Size',
        defaultValue: 28,
        min: 16,
        max: 48,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      descriptionFontSize: {
        type: ControlType.Number,
        title: 'Description Size',
        defaultValue: 14,
        min: 10,
        max: 20,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      priceFontSize: {
        type: ControlType.Number,
        title: 'Price Size',
        defaultValue: 56,
        min: 24,
        max: 80,
        step: 2,
        unit: 'px',
        displayStepper: true
      }
    }
  },

  featured: {
    type: ControlType.Object,
    title: 'Featured Tier',
    controls: {
      primaryButtonBackground: {
        type: ControlType.Color,
        title: 'Button BG',
        defaultValue: '#111111'
      },
      primaryButtonTextColor: {
        type: ControlType.Color,
        title: 'Button Text',
        defaultValue: '#FFFFFF'
      },
      featuredBorderColor: {
        type: ControlType.Color,
        title: 'Border',
        defaultValue: '#111111'
      },
      featuredCardBorderWidth: {
        type: ControlType.Number,
        title: 'Border Width',
        defaultValue: 2,
        min: 0,
        max: 10,
        step: 1,
        unit: 'px',
        displayStepper: true
      }
    }
  },

  standardButton: {
    type: ControlType.Object,
    title: 'Standard Buttons',
    controls: {
      secondaryButtonBackground: {
        type: ControlType.Color,
        title: 'Button BG',
        defaultValue: '#EDEDED'
      },
      secondaryButtonTextColor: {
        type: ControlType.Color,
        title: 'Button Text',
        defaultValue: '#000000'
      },
      buttonBorderColor: {
        type: ControlType.Color,
        title: 'Border',
        defaultValue: '#E1E1E1'
      },
      buttonHeight: {
        type: ControlType.Number,
        title: 'Height',
        defaultValue: 44,
        min: 34,
        max: 72,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      buttonRadius: {
        type: ControlType.Number,
        title: 'Radius',
        defaultValue: 8,
        min: 0,
        max: 30,
        step: 1,
        unit: 'px',
        displayStepper: true
      },
      buttonFontSize: {
        type: ControlType.Number,
        title: 'Font Size',
        defaultValue: 15,
        min: 10,
        max: 20,
        step: 1,
        unit: 'px',
        displayStepper: true
      }
    }
  }
})

export default CreemPricingTable
