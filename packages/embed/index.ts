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
  /** Whether the checkout has a merchant success URL (the embed never auto-navigates there unless you opt in). */
  redirect?: boolean;
  /** The merchant's success/return URL, if any. */
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
  /** Opt-in: on completion, navigate this page to the checkout's success URL. Off by default. */
  redirect?: boolean;
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
  function handler(event: MessageEvent): void {
    if (expectedOrigin && event.origin !== expectedOrigin) return;
    const data = event.data as Partial<{
      source: string;
      version: number;
      type: string;
    }> &
      CreemCheckoutCompleted;
    if (
      !data ||
      data.source !== CREEM_EMBED_SOURCE ||
      data.version !== CREEM_EMBED_PROTOCOL_VERSION
    )
      return;
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
      if (options.redirect && detail.redirectUrl) {
        window.location.href = detail.redirectUrl;
      }
    }
  }
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/** Open a checkout as a modal overlay. */
export function openCheckout(options: CreemCheckoutOptions): CreemCheckoutHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("openCheckout must run in the browser");
  }
  const checkoutUrl = withParams(options.checkoutUrl, options);

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;";

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:relative;width:min(460px,100%);height:min(860px,100%);background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);";

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label", "Close checkout");
  closeBtn.innerHTML = "&times;";
  // Flex-center the glyph; high-contrast pill so it reads on any checkout theme.
  closeBtn.style.cssText =
    "position:absolute;top:12px;right:12px;z-index:2;display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font-size:20px;line-height:1;font-family:system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.35);";

  const unsubscribe = subscribe(checkoutUrl, options);

  function cleanup(): void {
    unsubscribe();
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }
  function handleClose(): void {
    cleanup();
    options.onClose?.();
  }
  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") handleClose();
  }

  closeBtn.addEventListener("click", handleClose);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) handleClose();
  });
  document.addEventListener("keydown", onKey);

  wrap.appendChild(closeBtn);
  wrap.appendChild(makeIframe(checkoutUrl));
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);

  return { close: handleClose };
}

/** Mount a checkout inline into a container element. */
export function mount(
  options: CreemCheckoutOptions & { container: HTMLElement },
): CreemCheckoutInlineHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("mount must run in the browser");
  }
  const checkoutUrl = withParams(options.checkoutUrl, options);
  options.container.replaceChildren();
  const unsubscribe = subscribe(checkoutUrl, options);
  options.container.appendChild(makeIframe(checkoutUrl));
  return {
    destroy() {
      unsubscribe();
      options.container.replaceChildren();
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
