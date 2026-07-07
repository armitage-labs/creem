import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addPropertyControls, ControlType, RenderTarget } from 'framer'
import { ArrowUpRight } from './icons.tsx'

type Tier = {
  name: string
  monthlyPrice: number
  yearlyPrice: number
  monthlyPriceCents?: number | null
  yearlyPriceCents?: number | null
  currency?: string
  isOneTime?: boolean
  description: string
  features: string[]
  featuresTitle: string
  productId: string
  monthlyProductId?: string
  yearlyProductId?: string
  billingPeriod?: string
  ctaText: string
  ctaVariant: 'default' | 'outline' | 'ghost' | 'gradient' | 'shadow' | 'shimmer' | 'icon-slide'
  ctaBackground?: string
  ctaTextColor?: string
  highlighted: boolean
}

function formatTierAmount(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined) return '—'
  if (cents === 0) return 'Free'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function resolveTierPriceCents(tier: Tier, yearly: boolean): number | null {
  const cents = yearly ? tier.yearlyPriceCents : tier.monthlyPriceCents
  if (cents !== undefined && cents !== null) return cents
  const fallback = yearly ? tier.yearlyPrice : tier.monthlyPrice
  return Number.isFinite(fallback) ? Math.round(fallback * 100) : null
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

function resolveTierPeriod(tier: Tier, globalYearly: boolean): string | null {
  if (tier.isOneTime || tier.billingPeriod === 'once') return null
  const hasMonthly = !!tier.monthlyProductId
  const hasYearly = !!tier.yearlyProductId
  if (hasMonthly && hasYearly) return globalYearly ? 'year' : 'month'
  const fromBillingPeriod = resolveBillingPeriodLabel(tier.billingPeriod)
  if (fromBillingPeriod) return fromBillingPeriod
  if (hasYearly && !hasMonthly) return 'year'
  if (hasMonthly && !hasYearly) return 'month'
  if (!hasMonthly && !hasYearly) return null
  return null
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role='dialog'
      aria-modal='true'
      aria-label='Creem checkout'
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
        aria-label='Close checkout'
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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Checkout</span>
          <button
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
        <iframe src={url} title='Creem checkout' style={{ width: '100%', flex: 1, border: 'none', display: 'block' }} allow='payment *; clipboard-read; clipboard-write' />
      </div>
    </div>,
    document.body
  )
}

type Props = {
  tiers: Tier[]
  type: 'embed' | 'new-tab'
  layout: 'vertical' | 'grid' | 'horizontal'
  gridColumns?: number
  accentColor?: string

  // Header
  showHeader: boolean
  headerTitle: string
  headerDescription: string
  headerTitleFontSize: number
  headerDescriptionFontSize: number
  headerTitleColor: string
  headerDescriptionColor: string
  headerAlignment: 'left' | 'center' | 'right'

  // Toggle settings
  showYearlyToggle: boolean
  toggleMonthlyLabel: string
  toggleYearlyLabel: string
  toggleStyle: 'pill' | 'segmented'

  // Colors - Background
  pageBackground: string
  cardBackground: string

  // Colors - Borders
  borderColor: string
  featuredBorderColor: string
  dividerColor: string

  // Colors - Text
  textColor: string
  mutedTextColor: string

  // Colors - Buttons
  primaryButtonBackground: string
  primaryButtonTextColor: string
  secondaryButtonBackground: string
  secondaryButtonTextColor: string
  buttonBorderColor: string

  // Colors - Toggle
  toggleBackground: string
  toggleBorderColor: string
  toggleActiveBackground: string
  toggleActiveTextColor: string
  toggleTextColor: string

  // Colors - Features
  bulletColor: string

  // Typography
  titleFontSize: number
  descriptionFontSize: number
  priceFontSize: number
  featuresTitleFontSize: number
  featureFontSize: number
  buttonFontSize: number

  // Spacing & Layout
  cardRadius: number
  cardBorderWidth: number
  featuredCardBorderWidth: number
  cardPadding: number
  cardGap: number
  gridGap: number
  minCardWidth: number
  maxWidth: number

  // Button styling
  buttonHeight: number
  buttonRadius: number

  // Feature bullets
  bulletSize: number

  // Other
  testMode: boolean
}

const DEFAULT_TIERS: Props['tiers'] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Recommended for people with at least 1 year experience in crypto markets.',
    features: [
      'Access to real-time inventory tracking',
      'Integration with Digital Marketing email',
      'Basic analytics and email support',
      'Custom dashboards and Phone support',
      'Real-time data tracking and 24/7 support'
    ],
    featuresTitle: 'Features',
    productId: 'prod_free',
    ctaText: 'Free plan',
    ctaVariant: 'default',
    highlighted: false
  },
  {
    name: 'Premium',
    monthlyPrice: 99,
    yearlyPrice: 950,
    description: 'Everything in the Basic Plan plus advanced search, better analytics.',
    features: [
      'All Premium Plan features',
      'Advanced data filtering search capabilities',
      'Custom branding options',
      'Extended API access for integrations',
      'Real-time data tracking and 24/7 support',
      'Dedicated account manager'
    ],
    featuresTitle: 'Features',
    productId: 'prod_premium',
    ctaText: 'Purchase plan',
    ctaVariant: 'default',
    highlighted: true
  },
  {
    name: 'Enterprise',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    description: 'Includes all Professional Plan features plus full logistics automation etc.',
    features: [
      'Custom onboarding process',
      'Priority support response',
      'Access to exclusive webinars',
      'Monthly performance reviews',
      'Real-time data tracking and 24/7 support',
      'Dedicated account manager',
      'Tailored training sessions and resources'
    ],
    featuresTitle: 'Features',
    productId: 'prod_enterprise',
    ctaText: 'Purchase plan',
    ctaVariant: 'default',
    highlighted: false
  }
]

export function CreemPricingTable({
  tiers = DEFAULT_TIERS,
  type = 'embed',
  layout = 'grid',
  gridColumns = 3,
  accentColor = '#111111',

  // Header
  showHeader = true,
  headerTitle = 'Monetize Your Framer Projects',
  headerDescription = 'Launch subscriptions, one-time payments, and billing portals in minutes - no backend needed.',
  headerTitleFontSize = 48,
  headerDescriptionFontSize = 18,
  headerTitleColor = '#000000',
  headerDescriptionColor = '#9CA3AF',
  headerAlignment = 'center',

  // Toggle settings
  showYearlyToggle = true,
  toggleMonthlyLabel = 'Monthly',
  toggleYearlyLabel = 'Yearly',
  toggleStyle = 'pill',

  // Colors - Background
  pageBackground = 'transparent',
  cardBackground = '#FFFFFF',

  // Colors - Borders
  borderColor = '#E6E6E6',
  featuredBorderColor = '#111111',
  dividerColor = '#EDEDED',

  // Colors - Text
  textColor = '#000000',
  mutedTextColor = '#7A7A7A',

  // Colors - Buttons
  primaryButtonBackground = '#111111',
  primaryButtonTextColor = '#FFFFFF',
  secondaryButtonBackground = '#EDEDED',
  secondaryButtonTextColor = '#000000',
  buttonBorderColor = '#E1E1E1',

  // Colors - Toggle
  toggleBackground = '#FFFFFF',
  toggleBorderColor = '#E6E6E6',
  toggleActiveBackground = '#111111',
  toggleActiveTextColor = '#FFFFFF',
  toggleTextColor = '#111111',

  // Colors - Features
  bulletColor = '#111111',

  // Typography
  titleFontSize = 28,
  descriptionFontSize = 14,
  priceFontSize = 56,
  featuresTitleFontSize = 20,
  featureFontSize = 15,
  buttonFontSize = 15,

  // Spacing & Layout
  cardRadius = 14,
  cardBorderWidth = 2,
  featuredCardBorderWidth = 2,
  cardPadding = 26,
  cardGap = 18,
  gridGap = 22,
  minCardWidth = 300,
  maxWidth = 1200,

  // Button styling
  buttonHeight = 44,
  buttonRadius = 8,

  // Feature bullets
  bulletSize = 8,

  // Other
  testMode = false
}: Props) {
  const [yearly, setYearly] = useState(false)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
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
        cta: Math.round(buttonFontSize * 0.93),
        featuresTitle: Math.round(featuresTitleFontSize * 0.85),
        feature: Math.round(featureFontSize * 0.93)
      }
    if (breakpoint === 'tablet')
      return {
        title: Math.round(titleFontSize * 0.93),
        price: Math.round(priceFontSize * 0.93),
        description: Math.round(descriptionFontSize * 0.96),
        cta: Math.round(buttonFontSize * 0.96),
        featuresTitle: Math.round(featuresTitleFontSize * 0.93),
        feature: Math.round(featureFontSize * 0.96)
      }
    return {
      title: titleFontSize,
      price: priceFontSize,
      description: descriptionFontSize,
      cta: buttonFontSize,
      featuresTitle: featuresTitleFontSize,
      feature: featureFontSize
    }
  }
  const fonts = getFontSizes()

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transitionDuration = prefersReducedMotion ? '0s' : '0.3s'
  const handleCheckout = (tier: Tier) => {
    if (isCanvas) return
    let productId = tier.productId
    if (tier.monthlyProductId && tier.yearlyProductId) {
      productId = yearly ? tier.yearlyProductId : tier.monthlyProductId
    } else if (tier.monthlyProductId) {
      productId = tier.monthlyProductId
    } else if (tier.yearlyProductId) {
      productId = tier.yearlyProductId
    }
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
            gridTemplateColumns: breakpoint === 'mobile' ? 'minmax(0, 1fr)' : `repeat(${effectiveGridColumns}, minmax(${minCardWidth}px, 1fr))`,
            gap: spacing.gap,
            width: '100%',
            maxWidth: '100%',
            justifyItems: 'stretch',
            overflowX: breakpoint === 'mobile' ? undefined : 'auto'
          }
  const themeAccent = accentColor || primaryButtonBackground
  const featuredAccent = accentColor || featuredBorderColor
  return (
    <div
      style={{
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
      {/* ARIA live region for toggle changes */}
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
        {showYearlyToggle && `Billing interval: ${yearly ? 'yearly' : 'monthly'}`}
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
        {/* Monthly/Yearly Toggle */}
        {showYearlyToggle && (
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
            <button
              onClick={() => !isCanvas && setYearly(false)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && !isCanvas) {
                  e.preventDefault()
                  setYearly(false)
                }
              }}
              disabled={isCanvas}
              aria-pressed={!yearly}
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
                background: !yearly ? toggleActiveBackground : 'transparent',
                color: !yearly ? toggleActiveTextColor : toggleTextColor,
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
              id='billing-monthly-label'
            >
              {toggleMonthlyLabel}
            </button>
            <button
              onClick={() => !isCanvas && setYearly(true)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && !isCanvas) {
                  e.preventDefault()
                  setYearly(true)
                }
              }}
              disabled={isCanvas}
              aria-pressed={yearly}
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
                background: yearly ? toggleActiveBackground : 'transparent',
                color: yearly ? toggleActiveTextColor : toggleTextColor,
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
              id='billing-yearly-label'
            >
              {toggleYearlyLabel}
            </button>
          </div>
        )}
        {/* Pricing Cards */}
        <div style={{ ...cardsLayoutStyle, alignSelf: 'stretch' }}>
          {tiers.map((tier, idx) => {
            const hasMonthly = !!tier.monthlyProductId
            const hasYearly = !!tier.yearlyProductId
            const hasBoth = hasMonthly && hasYearly
            const currency = tier.currency || 'USD'
            const isOneTime = !!tier.isOneTime
            const period = resolveTierPeriod(tier, yearly)
            let priceCents: number | null
            if (isOneTime) {
              priceCents = resolveTierPriceCents(tier, false)
            } else if (hasBoth) {
              priceCents = resolveTierPriceCents(tier, yearly)
            } else if (hasYearly && !hasMonthly) {
              priceCents = resolveTierPriceCents(tier, true)
            } else {
              priceCents = resolveTierPriceCents(tier, false)
            }
            const formattedPrice = formatTierAmount(priceCents, currency)
            const buttonBg = resolveOptionalColor(tier.ctaBackground) ?? (tier.highlighted ? themeAccent : secondaryButtonBackground)
            const buttonColor = resolveOptionalColor(tier.ctaTextColor) ?? (tier.highlighted ? primaryButtonTextColor : secondaryButtonTextColor)

            // Helper function to adjust color brightness for gradient/shimmer
            const adjustColorBrightness = (color: string, percent: number): string => {
              const num = parseInt(color.replace('#', ''), 16)
              const amt = Math.round(2.55 * percent)
              const R = (num >> 16) + amt
              const G = ((num >> 8) & 0x00ff) + amt
              const B = (num & 0x0000ff) + amt
              return (
                '#' +
                (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1)
              )
            }

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
                    background: `linear-gradient(135deg, ${buttonBg} 0%, ${adjustColorBrightness(buttonBg, -20)} 100%)`,
                    color: buttonColor,
                    border: 'none'
                  }
                case 'shadow':
                  return {
                    ...baseStyles,
                    background: buttonBg,
                    color: buttonColor,
                    border: 'none',
                    boxShadow: `0 4px 14px 0 ${buttonBg}4d, 0 10px 20px 0 ${buttonBg}33`
                  }
                case 'shimmer':
                  return {
                    ...baseStyles,
                    background: `linear-gradient(110deg, ${buttonBg} 0%, ${adjustColorBrightness(buttonBg, 20)} 50%, ${buttonBg} 100%)`,
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
            const isLastCard = idx === tiers.length - 1
            const shouldTakeFullWidth = layout !== 'grid' && isLastCard && breakpoint === 'tablet' && tiers.length % 2 !== 0
            const cardStyle: React.CSSProperties = {
              position: 'relative',
              background: cardBackground,
              border: tier.highlighted ? `${featuredCardBorderWidth}px solid ${featuredAccent}` : `${cardBorderWidth}px solid ${borderColor}`,
              borderRadius: cardRadius,
              padding: spacing.cardPadding,
              display: 'flex',
              flexDirection: 'column',
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
                {/* Description */}
                <div
                  style={{
                    margin: '0 0 24px 0',
                    minHeight: 42,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                >
                  <TierDescriptionMarkdown text={tier.description} fontSize={fonts.description} color={mutedTextColor} headingColor={textColor} linkColor={themeAccent} />
                </div>
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
                {/* Separator */}
                <div
                  style={{
                    width: '100%',
                    height: 1,
                    background: dividerColor,
                    margin: '0 0 24px 0'
                  }}
                />
                {/* Features */}
                <div style={{ flex: 1 }}>
                  <h4
                    style={{
                      fontSize: fonts.featuresTitle,
                      fontWeight: 600,
                      color: textColor,
                      margin: '0 0 16px 0'
                    }}
                  >
                    {tier.featuresTitle || 'Features'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tier.features.map((feature, fIdx) => (
                      <div
                        key={fIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10
                        }}
                      >
                        <div
                          style={{
                            width: bulletSize,
                            height: bulletSize,
                            borderRadius: '50%',
                            background: bulletColor,
                            flexShrink: 0
                          }}
                        />
                        <span
                          style={{
                            fontSize: fonts.feature,
                            color: mutedTextColor,
                            lineHeight: 1.5
                          }}
                        >
                          {feature}
                        </span>
                      </div>
                    ))}
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
    hidden: (props: Props) => props.layout !== 'grid'
  },
  accentColor: {
    type: ControlType.Color,
    title: 'Accent Color',
    defaultValue: '#111111'
  },

  // Header
  showHeader: {
    type: ControlType.Boolean,
    title: 'Show Header',
    defaultValue: true,
    enabledTitle: 'Yes',
    disabledTitle: 'No'
  },
  headerTitle: {
    type: ControlType.String,
    title: 'Title',
    defaultValue: 'Monetize Your Framer Projects',
    hidden: (props: Props) => !props.showHeader
  },
  headerDescription: {
    type: ControlType.String,
    title: 'Description',
    defaultValue: 'Launch subscriptions, one-time payments, and billing portals in minutes - no backend needed.',
    displayTextArea: true,
    hidden: (props: Props) => !props.showHeader
  },
  headerAlignment: {
    type: ControlType.Enum,
    title: 'Alignment',
    options: ['left', 'center', 'right'],
    optionTitles: ['Left', 'Center', 'Right'],
    defaultValue: 'center',
    hidden: (props: Props) => !props.showHeader
  },
  headerTitleFontSize: {
    type: ControlType.Number,
    title: 'Title Font Size',
    defaultValue: 48,
    min: 24,
    max: 80,
    step: 2,
    unit: 'px',
    displayStepper: true,
    hidden: (props: Props) => !props.showHeader
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
    hidden: (props: Props) => !props.showHeader
  },
  headerTitleColor: {
    type: ControlType.Color,
    title: 'Title Color',
    defaultValue: '#000000',
    hidden: (props: Props) => !props.showHeader
  },
  headerDescriptionColor: {
    type: ControlType.Color,
    title: 'Description Color',
    defaultValue: '#9CA3AF',
    hidden: (props: Props) => !props.showHeader
  },
  tiers: {
    type: ControlType.Array,
    title: 'Pricing Tiers',
    control: {
      type: ControlType.Object,
      title: 'Tier',
      controls: {
        name: { type: ControlType.String, title: 'Name', defaultValue: 'Premium' },
        monthlyPrice: { type: ControlType.Number, title: 'Monthly Price', min: 0, defaultValue: 99, step: 1 },
        yearlyPrice: { type: ControlType.Number, title: 'Yearly Price', min: 0, defaultValue: 950, step: 1 },
        description: {
          type: ControlType.String,
          title: 'Description',
          defaultValue: 'Perfect for growing teams',
          displayTextArea: true
        },
        featuresTitle: {
          type: ControlType.String,
          title: 'Features Title',
          defaultValue: 'Features'
        },
        features: {
          type: ControlType.Array,
          title: 'Features',
          control: { type: ControlType.String, title: 'Feature', defaultValue: 'Feature item' },
          defaultValue: ['Feature 1', 'Feature 2', 'Feature 3']
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
        monthlyProductId: {
          type: ControlType.String,
          title: 'Monthly ID (Optional)',
          defaultValue: '',
          description: 'For separate monthly/yearly products'
        },
        yearlyProductId: {
          type: ControlType.String,
          title: 'Yearly ID (Optional)',
          defaultValue: '',
          description: 'For separate monthly/yearly products'
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

  // Toggle Settings
  showYearlyToggle: {
    type: ControlType.Boolean,
    title: 'Billing Toggle',
    defaultValue: true,
    enabledTitle: 'Show',
    disabledTitle: 'Hide'
  },
  toggleMonthlyLabel: {
    type: ControlType.String,
    title: 'Monthly Label',
    defaultValue: 'Monthly',
    hidden: (props: Props) => !props.showYearlyToggle
  },
  toggleYearlyLabel: {
    type: ControlType.String,
    title: 'Yearly Label',
    defaultValue: 'Yearly',
    hidden: (props: Props) => !props.showYearlyToggle
  },
  toggleStyle: {
    type: ControlType.Enum,
    title: 'Toggle Style',
    options: ['pill', 'segmented'],
    optionTitles: ['Pill', 'Segmented'],
    defaultValue: 'pill',
    displaySegmentedControl: true,
    hidden: (props: Props) => !props.showYearlyToggle
  },

  // Background Colors
  pageBackground: {
    type: ControlType.Color,
    title: 'Page Background',
    defaultValue: 'transparent'
  },
  cardBackground: {
    type: ControlType.Color,
    title: 'Card Background',
    defaultValue: '#FFFFFF'
  },

  // Border Colors
  borderColor: {
    type: ControlType.Color,
    title: 'Border Color',
    defaultValue: '#E6E6E6'
  },
  featuredBorderColor: {
    type: ControlType.Color,
    title: 'Featured Border',
    defaultValue: '#111111'
  },
  dividerColor: {
    type: ControlType.Color,
    title: 'Divider Color',
    defaultValue: '#EDEDED'
  },

  // Text Colors
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

  // Button Colors
  primaryButtonBackground: {
    type: ControlType.Color,
    title: 'Primary Button BG',
    defaultValue: '#111111'
  },
  primaryButtonTextColor: {
    type: ControlType.Color,
    title: 'Primary Button Text',
    defaultValue: '#FFFFFF'
  },
  secondaryButtonBackground: {
    type: ControlType.Color,
    title: 'Secondary Button BG',
    defaultValue: '#EDEDED'
  },
  secondaryButtonTextColor: {
    type: ControlType.Color,
    title: 'Secondary Button Text',
    defaultValue: '#000000'
  },
  buttonBorderColor: {
    type: ControlType.Color,
    title: 'Button Border',
    defaultValue: '#E1E1E1'
  },

  // Toggle Colors
  toggleBackground: {
    type: ControlType.Color,
    title: 'Toggle BG',
    defaultValue: '#FFFFFF',
    hidden: (props: Props) => !props.showYearlyToggle
  },
  toggleBorderColor: {
    type: ControlType.Color,
    title: 'Toggle Border',
    defaultValue: '#E6E6E6',
    hidden: (props: Props) => !props.showYearlyToggle
  },
  toggleActiveBackground: {
    type: ControlType.Color,
    title: 'Toggle Active BG',
    defaultValue: '#111111',
    hidden: (props: Props) => !props.showYearlyToggle
  },
  toggleActiveTextColor: {
    type: ControlType.Color,
    title: 'Toggle Active Text',
    defaultValue: '#FFFFFF',
    hidden: (props: Props) => !props.showYearlyToggle
  },
  toggleTextColor: {
    type: ControlType.Color,
    title: 'Toggle Text',
    defaultValue: '#111111',
    hidden: (props: Props) => !props.showYearlyToggle
  },

  // Feature Bullets
  bulletColor: {
    type: ControlType.Color,
    title: 'Bullet Color',
    defaultValue: '#111111'
  },
  bulletSize: {
    type: ControlType.Number,
    title: 'Bullet Size',
    defaultValue: 8,
    min: 4,
    max: 14,
    step: 1,
    unit: 'px',
    displayStepper: true
  },

  // Typography
  titleFontSize: {
    type: ControlType.Number,
    title: 'Title Font Size',
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
    title: 'Price Font Size',
    defaultValue: 56,
    min: 24,
    max: 80,
    step: 2,
    unit: 'px',
    displayStepper: true
  },
  featuresTitleFontSize: {
    type: ControlType.Number,
    title: 'Features Title Size',
    defaultValue: 20,
    min: 14,
    max: 32,
    step: 1,
    unit: 'px',
    displayStepper: true
  },
  featureFontSize: {
    type: ControlType.Number,
    title: 'Feature Font Size',
    defaultValue: 15,
    min: 10,
    max: 20,
    step: 1,
    unit: 'px',
    displayStepper: true
  },
  buttonFontSize: {
    type: ControlType.Number,
    title: 'Button Font Size',
    defaultValue: 15,
    min: 10,
    max: 20,
    step: 1,
    unit: 'px',
    displayStepper: true
  },

  // Card Styling
  cardRadius: {
    type: ControlType.Number,
    title: 'Card Radius',
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
  featuredCardBorderWidth: {
    type: ControlType.Number,
    title: 'Featured Border Width',
    defaultValue: 2,
    min: 0,
    max: 10,
    step: 1,
    unit: 'px',
    displayStepper: true
  },
  cardPadding: {
    type: ControlType.Number,
    title: 'Card Padding',
    defaultValue: 26,
    min: 10,
    max: 60,
    step: 1,
    unit: 'px',
    displayStepper: true
  },
  cardGap: {
    type: ControlType.Number,
    title: 'Card Gap',
    defaultValue: 18,
    min: 8,
    max: 40,
    step: 1,
    unit: 'px',
    displayStepper: true
  },

  // Layout
  gridGap: {
    type: ControlType.Number,
    title: 'Grid Gap',
    defaultValue: 22,
    min: 8,
    max: 60,
    step: 1,
    unit: 'px',
    displayStepper: true
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

  // Button Styling
  buttonHeight: {
    type: ControlType.Number,
    title: 'Button Height',
    defaultValue: 44,
    min: 34,
    max: 72,
    step: 1,
    unit: 'px',
    displayStepper: true
  },
  buttonRadius: {
    type: ControlType.Number,
    title: 'Button Radius',
    defaultValue: 8,
    min: 0,
    max: 30,
    step: 1,
    unit: 'px',
    displayStepper: true
  },

  // Other
  testMode: {
    type: ControlType.Boolean,
    title: 'Test Mode',
    defaultValue: false,
    enabledTitle: 'On',
    disabledTitle: 'Off'
  }
})

export default CreemPricingTable
