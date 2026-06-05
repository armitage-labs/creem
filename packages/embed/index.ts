// @creem_io/embed — framework-agnostic core for embedding Creem checkout.
//
// Manages the checkout iframe (modal overlay or inline) and the `creem-embed`
// postMessage protocol the checkout pages emit. Used directly (vanilla JS) or as
// the shared core for the framework wrappers (@creem_io/react, /vue, /svelte).
// Keep SOURCE/VERSION in sync with the hosted loader (creem.io/embed.js); bump
// VERSION on any protocol change.

export const CREEM_EMBED_SOURCE = "creem-embed" as const;
export const CREEM_EMBED_PROTOCOL_VERSION = 1 as const;

const IFRAME_ALLOW = "payment *; publickey-credentials-get *";

export interface CreemCheckoutCompleted {
  checkoutId: string;
  orderId?: string;
  orderNo?: string;
  /** Whether the checkout has a merchant success/return URL configured. */
  redirect?: boolean;
  /**
   * The merchant's success/return URL, if any. When present, the SDK navigates
   * the top window here after the in-iframe confirmation countdown.
   */
  redirectUrl?: string;
}

export interface CreemCheckoutOptions {
  /** Checkout session URL from the Creem Checkout API. */
  checkoutUrl: string;
  /** Color-theme hint appended to the checkout URL (`?theme=`). */
  theme?: "light" | "dark";
  /**
   * BCP47 locale to force the checkout language, appended as `?locale=`
   * (e.g. `"fr"`, `"pt-BR"`). Overrides the visitor's browser language.
   * Unsupported locales fall back to English.
   */
  locale?: string;
  /** Fired once the checkout UI has rendered and is ready for input. */
  onReady?: () => void;
  /** Fired once the payment completes. */
  onComplete?: (detail: CreemCheckoutCompleted) => void;
  /** Fired when the overlay is dismissed (overlay mode only). */
  onClose?: () => void;
}

export interface CreemCheckoutHandle {
  close: () => void;
}

export interface CreemCheckoutInlineHandle {
  destroy: () => void;
}

// Append the merchant-controlled presentation params (`theme`, `locale`) to the
// checkout URL. Both are optional; the checkout page falls back to its defaults
// (browser language, light theme) when absent.
function withParams(url: string, options: CreemCheckoutOptions): string {
  if (!options.theme && !options.locale) return url;
  try {
    const parsed = new URL(url);
    if (options.theme) parsed.searchParams.set("theme", options.theme);
    if (options.locale) parsed.searchParams.set("locale", options.locale);
    return parsed.toString();
  } catch {
    return url;
  }
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function makeIframe(checkoutUrl: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = checkoutUrl;
  iframe.setAttribute("allow", IFRAME_ALLOW);
  iframe.title = "Creem checkout";
  iframe.style.cssText = "border:0;width:100%;height:100%;";
  return iframe;
}

// Subscribe to lifecycle events (`ready`, `completed`) for a given checkout
// frame. Accepts events ONLY from the checkout's own origin (anti-spoof under
// open framing).
function subscribe(checkoutUrl: string, options: CreemCheckoutOptions): () => void {
  const expectedOrigin = originOf(checkoutUrl);
  let redirectTimer: ReturnType<typeof setTimeout> | null = null;
  function handler(event: MessageEvent): void {
    if (expectedOrigin && event.origin !== expectedOrigin) return;
    const data = event.data as Partial<{
      source: string;
      version: number;
      type: string;
    }> &
      CreemCheckoutCompleted;
    // SECURITY: the origin check above is the gate. We do NOT gate on protocol
    // version — the SDK is forward-compatible, so a pinned older SDK keeps
    // working against a newer checkout deploy (it handles the event types it
    // knows and ignores the rest). Breaking changes ship as a new event type.
    if (!data || data.source !== CREEM_EMBED_SOURCE) return;
    if (data.type === "ready") {
      options.onReady?.();
    } else if (data.type === "completed") {
      const detail: CreemCheckoutCompleted = {
        checkoutId: data.checkoutId,
        orderId: data.orderId,
        orderNo: data.orderNo,
        redirect: data.redirect,
        redirectUrl: data.redirectUrl,
      };
      options.onComplete?.(detail);
      // Single-event model: no separate "redirect" event. The checkout shows a
      // ~3s "Returning to merchant" confirmation in-iframe; we mirror that delay
      // here, then navigate the top window (a cross-origin iframe can't move it
      // itself). Cancelled on close/unsubscribe below, so a checkout the
      // customer closed never navigates the merchant.
      if (detail.redirectUrl) {
        const url = detail.redirectUrl;
        redirectTimer = setTimeout(() => {
          window.location.href = url;
        }, 3000);
      }
    }
  }
  window.addEventListener("message", handler);
  return () => {
    window.removeEventListener("message", handler);
    if (redirectTimer) clearTimeout(redirectTimer);
  };
}

/** Open a checkout as a modal overlay. */
export function openCheckout(options: CreemCheckoutOptions): CreemCheckoutHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("openCheckout must run in the browser");
  }
  // Fail loudly on a malformed URL — otherwise the origin check can never match
  // and onReady/onComplete would silently never fire.
  if (!originOf(options.checkoutUrl)) {
    throw new Error("openCheckout: `checkoutUrl` is not a valid URL");
  }
  const checkoutUrl = withParams(options.checkoutUrl, options);
  // Surface color behind the iframe — matched to the checkout theme so the
  // rounded corners and any overscroll never flash white on a dark checkout.
  const isDark = options.theme === "dark";
  const surface = isDark ? "#000" : "#fff";
  const btnBg = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)";
  const btnBorder = isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)";
  const btnColor = isDark ? "#e5e5e5" : "#3f3f46";

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:30px;";

  // Coral brand edge (right + bottom) + its matching glow live on this one
  // element — no separate overlay div.
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:relative;display:flex;flex-direction:column;width:min(460px,100%);height:min(860px,100%);background:" +
    surface +
    ";border-radius:14px;overflow:hidden;border-right:3px solid #ff8f5e;border-bottom:3px solid #ff8f5e;box-shadow:8px 0 28px -10px rgba(255,140,80,.6),0 8px 28px -10px rgba(255,140,80,.6);";

  // Slim header strip that owns the close button, so it never overlaps the
  // checkout content (e.g. the price in the checkout header's top-right).
  const bar = document.createElement("div");
  bar.style.cssText =
    "flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;height:44px;padding:0 10px;background:" +
    surface +
    ";";

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label", "Close checkout");
  // Crisp SVG glyph — perfectly centered (the &times; glyph sits low in its line box).
  closeBtn.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 2 12 12M12 2 2 12"/></svg>';
  closeBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:1px solid " +
    btnBorder +
    ";border-radius:10px;background:" +
    btnBg +
    ";color:" +
    btnColor +
    ";cursor:pointer;transition:background .15s,color .15s,border-color .15s,box-shadow .15s;";
  // Violet hover state (matches the dashboard's modal close button).
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "#a78bfa";
    closeBtn.style.borderColor = "#a78bfa";
    closeBtn.style.color = "#2e1065";
    closeBtn.style.boxShadow = "0 2px 10px rgba(167,139,250,.55)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = btnBg;
    closeBtn.style.borderColor = btnBorder;
    closeBtn.style.color = btnColor;
    closeBtn.style.boxShadow = "none";
  });

  // Fill the space under the bar; theme surface prevents a white flash on load.
  const iframe = makeIframe(checkoutUrl);
  iframe.style.flex = "1 1 auto";
  iframe.style.height = "auto";
  iframe.style.minHeight = "0";
  iframe.style.background = surface;

  const unsubscribe = subscribe(checkoutUrl, options);

  function cleanup(): void {
    unsubscribe();
    overlay.remove();
  }
  function handleClose(): void {
    cleanup();
    options.onClose?.();
  }

  // The checkout closes ONLY via the explicit ✕ button — NO backdrop-click and
  // NO Escape dismissal, so a customer can't lose an in-progress payment by
  // clicking outside the modal or pressing a key. (Matches public/embed.js.)
  closeBtn.addEventListener("click", handleClose);

  bar.appendChild(closeBtn);
  wrap.appendChild(bar);
  wrap.appendChild(iframe);
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);
  // Move keyboard focus into the checkout so Tab stays inside the modal.
  iframe.focus();

  return { close: handleClose };
}

// Tracks the active inline teardown per container, so re-mounting on the same
// container tears down the previous subscription instead of leaking its message
// listener (which would otherwise double-fire onComplete on the next checkout).
const inlineTeardowns = new WeakMap<HTMLElement, () => void>();

/** Mount a checkout inline into a container element. */
export function mount(
  options: CreemCheckoutOptions & { container: HTMLElement },
): CreemCheckoutInlineHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("mount must run in the browser");
  }
  if (!originOf(options.checkoutUrl)) {
    throw new Error("mount: `checkoutUrl` is not a valid URL");
  }
  const { container } = options;
  const checkoutUrl = withParams(options.checkoutUrl, options);
  inlineTeardowns.get(container)?.();
  container.replaceChildren();
  const unsubscribe = subscribe(checkoutUrl, options);
  const iframe = makeIframe(checkoutUrl);
  iframe.style.background = options.theme === "dark" ? "#000" : "#fff";
  container.appendChild(iframe);
  const teardown = (): void => {
    unsubscribe();
    inlineTeardowns.delete(container);
  };
  inlineTeardowns.set(container, teardown);
  return {
    destroy() {
      teardown();
      container.replaceChildren();
    },
  };
}

/**
 * Programmatic, promise-based opener. Resolves once the checkout has rendered
 * (the `ready` event), with a safety-net timeout so it never hangs if `ready`
 * doesn't arrive.
 */
export const CreemEmbedCheckout = {
  create(options: CreemCheckoutOptions): Promise<CreemCheckoutHandle> {
    return new Promise((resolve) => {
      let resolved = false;
      const settle = (handle: CreemCheckoutHandle): void => {
        if (resolved) return;
        resolved = true;
        resolve(handle);
      };
      const handle = openCheckout({
        ...options,
        onReady: () => {
          options.onReady?.();
          settle(handle);
        },
      });
      window.setTimeout(() => settle(handle), 3000);
    });
  },
};
