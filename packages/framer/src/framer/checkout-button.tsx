import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { addPropertyControls, ControlType, RenderTarget } from 'framer'
import { ArrowUpRight, Loader2 } from './icons.tsx'

function buildCreemCheckoutUrl(productId: string, testMode: boolean, discountCode?: string, successUrl?: string): string {
  const base = testMode ? 'https://creem.io/test/payment' : 'https://creem.io/payment'
  const checkoutUrl = new URL(`${base}/${productId}`)
  if (discountCode) checkoutUrl.searchParams.set('discount_code', discountCode)
  if (successUrl) checkoutUrl.searchParams.set('success_url', successUrl)
  return checkoutUrl.toString()
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
  variant: 'default' | 'outline' | 'ghost' | 'gradient' | 'shadow' | 'shimmer' | 'icon-slide'
  type: 'Embed' | 'New Tab'
  productId: string
  buttonText: string
  backgroundColor: string
  textColor: string
  borderRadius: number
  fontSize: number
  paddingX: number
  paddingY: number
  discountCode: string
  successUrl: string
  testMode: boolean
  fullWidth: boolean
  linkTarget: '_blank' | '_self'
}

export function CreemCheckoutButton({
  variant = 'default',
  type = 'Embed',
  productId = 'prod_YOUR_PRODUCT_ID',
  buttonText = 'Buy Now',
  backgroundColor = '#FFBE98',
  textColor = '#FFFFFF',
  borderRadius = 10,
  fontSize = 15,
  paddingX = 24,
  paddingY = 12,
  discountCode = '',
  successUrl = '',
  testMode = false,
  fullWidth = false,
  linkTarget = '_blank'
}: Props) {
  // States
  const [loading, setLoading] = useState(false)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const isCanvas = RenderTarget.current() === RenderTarget.canvas

  // Responsive breakpoint detection with resize listener
  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width < 480) setBreakpoint('mobile')
      else if (width < 768) setBreakpoint('tablet')
      else setBreakpoint('desktop')
    }
    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  // Responsive adjustments
  const responsiveFontSize = breakpoint === 'mobile' ? Math.max(fontSize - 1, 13) : fontSize
  const responsivePaddingX = breakpoint === 'mobile' ? Math.max(paddingX - 4, 16) : paddingX
  const responsivePaddingY = breakpoint === 'mobile' ? Math.max(paddingY - 2, 10) : paddingY
  const handleClick = useCallback(() => {
    if (isCanvas) {
      console.log('⚠️ Button is disabled in Canvas edit mode. Click Preview to test.')
      return
    }

    setErrorMessage(null)

    // Only validate if it's still the exact default placeholder
    if (productId === 'prod_YOUR_PRODUCT_ID') {
      console.error('❌ Please insert this button through the Creem plugin and select a product')
      setErrorMessage('Please insert this button through the Creem plugin and select a product from the dropdown.')
      return
    }

    // If productId exists and is not the default, trust it and open checkout
    if (!productId || productId.trim() === '') {
      console.error('❌ Product ID is empty')
      setErrorMessage('Product ID is missing. Please re-insert this button through the Creem plugin.')
      return
    }
    console.log('🚀 Opening checkout for product:', productId)
    setLoading(true)
    const url = buildCreemCheckoutUrl(productId, testMode, discountCode, successUrl)
    console.log('📍 Checkout URL:', url)
    if (type === 'New Tab') {
      window.open(url, linkTarget, 'noopener,noreferrer')
      setTimeout(() => setLoading(false), 1500)
    } else {
      setEmbedUrl(url)
      setLoading(false)
    }
  }, [isCanvas, productId, type, linkTarget, testMode, discountCode, successUrl])
  const closeEmbed = useCallback(() => {
    setEmbedUrl(null)
  }, [])

  // Get variant-specific styles
  const getVariantStyles = (): React.CSSProperties => {
    // Icon slide variant needs special padding
    const isIconSlide = variant === 'icon-slide'
    const iconSlidePadding = isIconSlide
      ? `${responsivePaddingY}px ${responsivePaddingX + 40}px ${responsivePaddingY}px ${responsivePaddingX}px`
      : `${responsivePaddingY}px ${responsivePaddingX}px`
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: fullWidth ? '100%' : 'auto',
      maxWidth: '100%',
      padding: isIconSlide ? iconSlidePadding : `${responsivePaddingY}px ${responsivePaddingX}px`,
      minHeight: 44,
      borderRadius: isIconSlide ? 9999 : borderRadius,
      fontSize: responsiveFontSize,
      fontWeight: 600,
      fontFamily: 'inherit',
      cursor: isCanvas ? 'default' : 'pointer',
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      outline: 'none',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }
    switch (variant) {
      case 'icon-slide':
        return {
          ...baseStyles,
          backgroundColor,
          color: textColor,
          border: 'none'
        }
      case 'outline':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          color: backgroundColor,
          border: `2px solid ${backgroundColor}`
        }
      case 'ghost':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          color: backgroundColor,
          border: 'none'
        }
      case 'gradient':
        return {
          ...baseStyles,
          background: `linear-gradient(135deg, ${backgroundColor} 0%, color-mix(in srgb, ${backgroundColor}, black 20%) 100%)`,
          color: textColor,
          border: 'none'
        }
      case 'shadow':
        return {
          ...baseStyles,
          backgroundColor,
          color: textColor,
          border: 'none',
          boxShadow: `0 4px 14px 0 color-mix(in srgb, ${backgroundColor} 30%, transparent), 0 10px 20px 0 color-mix(in srgb, ${backgroundColor} 20%, transparent)`
        }
      case 'shimmer':
        return {
          ...baseStyles,
          backgroundColor,
          color: textColor,
          border: 'none',
          background: `linear-gradient(110deg, ${backgroundColor} 0%, color-mix(in srgb, ${backgroundColor}, white 20%) 50%, ${backgroundColor} 100%)`,
          backgroundSize: '200% 100%'
        }
      default:
        return {
          ...baseStyles,
          backgroundColor,
          color: textColor,
          border: 'none'
        }
    }
  }

  return (
    <>
      <style>{`
        .creem-checkout-btn:not(:disabled):hover {
          opacity: 0.88 !important;
        }
        .creem-checkout-btn.creem-ghost:not(:disabled):hover {
          background-color: rgba(0,0,0,0.05) !important;
          opacity: 1 !important;
        }
        .creem-checkout-btn.creem-shimmer:not(:disabled) {
          animation: shimmer 2s linear infinite;
        }
        .creem-checkout-btn.creem-icon-slide:not(:disabled):hover {
          padding-left: ${responsivePaddingX + 40}px !important;
          padding-right: ${responsivePaddingX}px !important;
        }
        .creem-icon-circle {
          position: absolute;
          right: ${responsivePaddingY / 2}px;
          width: ${responsivePaddingY * 2.5}px;
          height: ${responsivePaddingY * 2.5}px;
          background: ${textColor === '#FFFFFF' ? '#000000' : '#FFFFFF'};
          color: ${textColor === '#FFFFFF' ? '#FFFFFF' : '#000000'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .creem-checkout-btn.creem-icon-slide:not(:disabled):hover .creem-icon-circle {
          right: calc(100% - ${responsivePaddingY * 2.5 + responsivePaddingY / 2}px);
          transform: rotate(45deg);
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .creem-checkout-btn:not(:disabled):active { transform: scale(0.97) !important; }
        .creem-checkout-btn:focus-visible {
          outline: 2px solid currentColor !important;
          outline-offset: 2px !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 0.7s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .creem-checkout-btn { transition: none !important; }
          .creem-checkout-btn.creem-shimmer { animation: none !important; }
          .creem-checkout-btn.creem-icon-slide:not(:disabled):hover { padding: ${responsivePaddingY}px ${responsivePaddingX + 40}px ${responsivePaddingY}px ${responsivePaddingX}px !important; }
          .creem-checkout-btn.creem-icon-slide:not(:disabled):hover .creem-icon-circle { right: ${responsivePaddingY / 2}px !important; transform: none !important; }
          .animate-spin { animation: none !important; }
        }
        .creem-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
      <div role='status' aria-live='polite' aria-atomic='true' className='creem-sr-only'>
        {loading ? 'Processing checkout, please wait...' : ''}
      </div>
      <button
        className={`creem-checkout-btn ${variant === 'ghost' ? 'creem-ghost' : ''} ${variant === 'shimmer' ? 'creem-shimmer' : ''} ${variant === 'icon-slide' ? 'creem-icon-slide' : ''}`}
        style={getVariantStyles()}
        onClick={handleClick}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && !loading && !isCanvas) {
            e.preventDefault()
            handleClick()
          }
        }}
        disabled={loading || isCanvas}
        aria-label={`${buttonText} - Opens Creem checkout${type === 'Embed' ? ' in page' : ' in new tab'}`}
        aria-busy={loading}
        aria-disabled={isCanvas}
        aria-describedby={isCanvas ? 'creem-canvas-msg' : undefined}
        type='button'
        tabIndex={isCanvas ? -1 : 0}
      >
        {loading ? (
          <>
            <Loader2 size={14} className='animate-spin' style={{ color: textColor }} />
            Redirecting…
          </>
        ) : (
          <>
            {buttonText}
            {variant === 'icon-slide' && (
              <div className='creem-icon-circle' aria-hidden='true'>
                <ArrowUpRight size={16} />
              </div>
            )}
          </>
        )}
      </button>
      {isCanvas && (
        <div id='creem-canvas-msg' className='creem-sr-only'>
          Button is disabled in canvas edit mode. Preview or publish to test checkout.
        </div>
      )}
      {errorMessage && (
        <div
          role='alert'
          style={{
            marginTop: 8,
            maxWidth: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(220, 38, 38, 0.1)',
            color: '#dc2626',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.4,
            fontFamily: 'inherit',
            whiteSpace: 'normal',
            boxSizing: 'border-box'
          }}
        >
          {errorMessage}
        </div>
      )}
      {embedUrl && <CheckoutEmbedModal url={embedUrl} onClose={closeEmbed} />}
    </>
  )
}

addPropertyControls(CreemCheckoutButton, {
  variant: {
    type: ControlType.Enum,
    title: 'Variant',
    options: ['default', 'outline', 'ghost', 'gradient', 'shadow', 'shimmer', 'icon-slide'],
    optionTitles: ['Default', 'Outline', 'Ghost', 'Gradient', 'Shadow', 'Shimmer', 'Icon Slide'],
    defaultValue: 'default'
  },
  type: {
    type: ControlType.Enum,
    title: 'Type',
    options: ['Embed', 'New Tab'],
    optionTitles: ['Embed', 'New Tab'],
    displaySegmentedControl: true,
    defaultValue: 'Embed'
  },
  productId: {
    type: ControlType.String,
    title: 'Product ID',
    description: 'Set via plugin - your Creem product ID',
    placeholder: 'prod_abc123'
  },
  buttonText: {
    type: ControlType.String,
    title: 'Button Text',
    placeholder: 'Buy Now'
  },
  backgroundColor: {
    type: ControlType.Color,
    title: 'Background',
    defaultValue: '#FFBE98'
  },
  textColor: {
    type: ControlType.Color,
    title: 'Text Color',
    defaultValue: '#FFFFFF'
  },
  borderRadius: {
    type: ControlType.Number,
    title: 'Radius',
    min: 0,
    max: 50,
    step: 1,
    defaultValue: 10,
    displayStepper: true
  },
  fontSize: {
    type: ControlType.Number,
    title: 'Font Size',
    min: 10,
    max: 32,
    step: 1,
    defaultValue: 15,
    displayStepper: true
  },
  paddingX: {
    type: ControlType.Number,
    title: 'Padding X',
    min: 8,
    max: 64,
    step: 2,
    defaultValue: 24,
    displayStepper: true
  },
  paddingY: {
    type: ControlType.Number,
    title: 'Padding Y',
    min: 6,
    max: 32,
    step: 2,
    defaultValue: 12,
    displayStepper: true
  },
  fullWidth: {
    type: ControlType.Boolean,
    title: 'Full Width',
    defaultValue: false,
    enabledTitle: 'Yes',
    disabledTitle: 'No'
  },
  discountCode: {
    type: ControlType.String,
    title: 'Discount Code',
    placeholder: 'LAUNCH50'
  },
  successUrl: {
    type: ControlType.String,
    title: 'Success URL',
    placeholder: 'https://yoursite.com/thanks'
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
  }
})

export default CreemCheckoutButton
