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

// Storage key for the affiliate ref token, persisted first-party on the
// merchant's own origin (not our partitioned third-party context) so it survives
// internal navigation away from the /affiliate landing URL (e.g. `/` ->
// `/pricing`) before the embed opens.
const REF_STORAGE_KEY = "creem_ref";

function readRefFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("creem_ref");
  } catch {
    return null;
  }
}

function storeRef(token: string): void {
  try {
    window.localStorage.setItem(REF_STORAGE_KEY, token);
  } catch {
    /* localStorage unavailable (private mode / disabled) — best-effort. */
  }
}

function readStoredRef(): string | null {
  try {
    return window.localStorage.getItem(REF_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Read the affiliate ref token (`creem_ref`). The /affiliate redirect lands the
// visitor on the merchant's own site with `?creem_ref=<signed token>` —
// first-party to the visitor, so it's readable here even though the cross-site
// checkout iframe receives no cookie in any browser. We persist it to first-party
// storage so it survives internal navigation that drops the param before the embed
// opens, and fall back to that stored value when the URL has none (ENG-757). See
// readAffiliateRef below for the newer-token-wins ordering.
// Mint time (`iat`, ms epoch) of a signed token, read from its base64url JSON
// payload (no signature check — that's the server's job). Returns 0 when it can't
// be parsed, so a malformed token always loses the freshness comparison.
function tokenIat(token: string): number {
  try {
    let b64 = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(atob(b64)) as { iat?: number };
    return typeof payload.iat === "number" ? payload.iat : 0;
  } catch {
    return 0;
  }
}

function readAffiliateRef(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = readRefFromUrl();
  const stored = readStoredRef();
  // Keep the NEWER of the two by mint time (`iat`, server-stamped → immune to
  // client clock skew): a fresh affiliate click wins and is persisted; a stale
  // URL token (old bookmark / email link) can't clobber a newer stored ref. The
  // server still enforces the signature + `exp`, so an expired token is rejected.
  if (fromUrl && (!stored || tokenIat(fromUrl) >= tokenIat(stored))) {
    storeRef(fromUrl);
    return fromUrl;
  }
  return stored || fromUrl || null;
}

/**
 * Capture the affiliate ref token (`creem_ref`) from the current URL into
 * first-party storage. `openCheckout`/`mount` already do this, but only when the
 * visitor opens the checkout — if your affiliate landing page and your checkout
 * page differ (the visitor lands on `/?creem_ref=…`, then navigates to
 * `/pricing` before buying), the param is gone from the URL by the time checkout
 * opens, and since the embed relies on the token (the cross-site iframe gets no
 * cookie in any browser), attribution is then lost. Call this once early in your app — e.g. a root
 * layout effect — so the token is captured on the landing page and stays
 * available later. Safe anywhere: a no-op on the server and when no token is
 * present. Returns the active token (URL or previously stored), or null.
 */
export function captureAffiliateRef(): string | null {
  return readAffiliateRef();
}

// Append the merchant-controlled presentation params (`theme`, `locale`) and the
// affiliate ref token (`creem_ref`) to the checkout URL. Presentation params are
// optional; the checkout page falls back to its defaults (browser language,
// light theme) when absent. Forwarding `creem_ref` into the iframe URL is what
// carries affiliate attribution across the third-party boundary (ENG-757), so it
// survives in browsers that drop the cookie.
function withParams(url: string, options: CreemCheckoutOptions): string {
  const ref = readAffiliateRef();
  if (!options.theme && !options.locale && !ref) return url;
  try {
    const parsed = new URL(url);
    if (options.theme) parsed.searchParams.set("theme", options.theme);
    if (options.locale) parsed.searchParams.set("locale", options.locale);
    // Don't clobber a creem_ref the merchant already put on the checkout URL.
    if (ref && !parsed.searchParams.has("creem_ref")) {
      parsed.searchParams.set("creem_ref", ref);
    }
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

// Treat the apex and the `www.` subdomain of the SAME host as one origin.
// Production canonicalizes `creem.io` -> `www.creem.io` with a 308 redirect, so a
// checkout opened at `https://creem.io/checkout/...` (the URL the API hands
// merchants) actually loads — and posts its `ready`/`completed` events — from
// `https://www.creem.io`. A strict `===` against the merchant-supplied origin
// then silently drops those events and the post-payment redirect never fires
// (ENG-809). Folding a leading `www.` cannot widen trust to an unrelated host;
// protocol and port must still match exactly.
function sameOrigin(actualOrigin: string, expectedOrigin: string): boolean {
  if (actualOrigin === expectedOrigin) return true;
  if (!actualOrigin || !expectedOrigin) return false;
  try {
    const actual = new URL(actualOrigin);
    const expected = new URL(expectedOrigin);
    if (actual.protocol !== expected.protocol) return false;
    if (actual.port !== expected.port) return false;
    return actual.hostname.replace(/^www\./, "") === expected.hostname.replace(/^www\./, "");
  } catch {
    return false;
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
    if (expectedOrigin && !sameOrigin(event.origin, expectedOrigin)) return;
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
      // Single-event model: no separate "redirect" event. The checkout shows a
      // ~3s "Returning to merchant" confirmation in-iframe; we mirror that delay
      // here, then navigate the top window (a cross-origin iframe can't move it
      // itself).
      //
      // Order matters: the timer is scheduled BEFORE onComplete. A merchant that
      // calls handle.close() inside onComplete triggers unsubscribe() ->
      // clearTimeout below, which must find a LIVE timer to cancel. If we
      // scheduled after onComplete, close()'s clearTimeout would run against a
      // still-null timer and the redirect would fire anyway — navigating a
      // customer who explicitly closed the modal.
      if (detail.redirectUrl) {
        const url = detail.redirectUrl;
        redirectTimer = setTimeout(() => {
          window.location.href = url;
        }, 3000);
      }
      options.onComplete?.(detail);
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
  const surface = isDark ? "#000" : "#f9fafb";
  const btnBg = "#333";
  const btnColor = "#fff";

  const overlay = document.createElement("div");
  // Scroll container (overflow:auto) so a tall modal still scrolls on a short
  // viewport; overscroll-behavior:contain keeps that scroll from chaining
  // through to the merchant page behind it.
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(1,1,1,.7);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;overscroll-behavior:contain;";

  // Column that stacks the close button above the modal; its width matches the
  // modal so an align-self:flex-end button lines up with the modal's right edge.
  const modalColumn = document.createElement("div");
  modalColumn.style.cssText =
    "display:flex;flex-direction:column;gap:12px;width:min(460px,100%);height:min(860px,100%);";

  // The modal itself — fills the column below the close button.
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:relative;display:flex;flex-direction:column;width:100%;flex:1 1 auto;min-height:0;background:" +
    surface +
    ";border-radius:14px;overflow:hidden;";

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label", "Close checkout");
  // Crisp SVG glyph — perfectly centered (the &times; glyph sits low in its line box).
  closeBtn.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 2 12 12M12 2 2 12"/></svg>';
  closeBtn.style.cssText =
    "align-self:flex-end;flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border-radius:10px;border:none;background:" +
    btnBg +
    ";color:" +
    btnColor +
    ";cursor:pointer;transition:background .15s,color .15s,border-color .15s,box-shadow .15s;";
  // Violet hover state (matches the dashboard's modal close button).
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "#a78bfa";
    closeBtn.style.color = "#2e1065";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = btnBg;
    closeBtn.style.color = btnColor;
  });

  // Fill the modal; theme surface prevents a white flash on load.
  const iframe = makeIframe(checkoutUrl);
  iframe.style.flex = "1 1 auto";
  iframe.style.height = "auto";
  iframe.style.minHeight = "0";
  iframe.style.background = surface;

  const unsubscribe = subscribe(checkoutUrl, options);

  // Stash the merchant's prior body overflow so we restore it exactly on close
  // (we lock it to "hidden" below so the page behind the modal can't scroll).
  let prevBodyOverflow = "";
  function cleanup(): void {
    unsubscribe();
    overlay.remove();
    document.body.style.overflow = prevBodyOverflow;
  }
  function handleClose(): void {
    cleanup();
    options.onClose?.();
  }

  // The checkout closes ONLY via the explicit ✕ button — NO backdrop-click and
  // NO Escape dismissal, so a customer can't lose an in-progress payment by
  // clicking outside the modal or pressing a key. (Matches public/embed.js.)
  closeBtn.addEventListener("click", handleClose);

  modalColumn.appendChild(closeBtn);
  modalColumn.appendChild(wrap);
  wrap.appendChild(iframe);
  overlay.appendChild(modalColumn);
  // Lock the merchant page's scroll while the modal is open (iOS Safari touch
  // momentum can still scroll the body even with overscroll-behavior set on the
  // overlay). Restored on close via cleanup().
  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
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
