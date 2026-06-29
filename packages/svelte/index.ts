import {
  openCheckout,
  mount,
  captureAffiliateRef,
  CreemEmbedCheckout,
  type CreemCheckoutCompleted,
  type CreemCheckoutOptions,
  type CreemCheckoutHandle,
  type CreemCheckoutInlineHandle,
} from "@creem_io/embed";

// @creem_io/svelte — Svelte actions to embed Creem checkout. Thin wrapper over
// @creem_io/embed. Actions are plain functions, so no Svelte compiler is needed.

export {
  openCheckout,
  mount,
  captureAffiliateRef,
  CreemEmbedCheckout,
  type CreemCheckoutCompleted,
  type CreemCheckoutOptions,
  type CreemCheckoutHandle,
  type CreemCheckoutInlineHandle,
};

// Local action-return shape — avoids a hard `svelte` import for types.
interface ActionReturn<P> {
  update?: (params: P) => void;
  destroy?: () => void;
}

/**
 * Svelte action — open the checkout overlay when the node is clicked:
 *   <button use:creemCheckout={{ checkoutUrl, onComplete }}>Buy</button>
 */
export function creemCheckout(
  node: HTMLElement,
  options: CreemCheckoutOptions,
): ActionReturn<CreemCheckoutOptions> {
  let current = options;
  const handleClick = (): CreemCheckoutHandle => openCheckout(current);
  node.addEventListener("click", handleClick);
  return {
    update(next: CreemCheckoutOptions) {
      current = next;
    },
    destroy() {
      node.removeEventListener("click", handleClick);
    },
  };
}

/**
 * Svelte action — mount the checkout inline into the node:
 *   <div use:creemCheckoutInline={{ checkoutUrl, onComplete }} />
 */
export function creemCheckoutInline(
  node: HTMLElement,
  options: CreemCheckoutOptions,
): ActionReturn<CreemCheckoutOptions> {
  let handle: CreemCheckoutInlineHandle = mount({ ...options, container: node });
  return {
    update(next: CreemCheckoutOptions) {
      handle.destroy();
      handle = mount({ ...next, container: node });
    },
    destroy() {
      handle.destroy();
    },
  };
}

// ---- Svelte 5.29+ attachments (the modern low-level API) ----
// Used with the `{@attach ...}` directive. Attachments are plain functions, so
// no Svelte compiler is needed here. For Svelte 4, use the actions above.

/**
 * Open the checkout overlay when the element is clicked:
 *   <button {@attach creemCheckoutAttach({ checkoutUrl, onComplete })}>Buy</button>
 */
export function creemCheckoutAttach(options: CreemCheckoutOptions): (node: Element) => () => void {
  return (node: Element) => {
    const handleClick = (): CreemCheckoutHandle => openCheckout(options);
    node.addEventListener("click", handleClick);
    return () => node.removeEventListener("click", handleClick);
  };
}

/**
 * Mount the checkout inline into the element:
 *   <div {@attach creemCheckoutInlineAttach({ checkoutUrl, onComplete })}></div>
 */
export function creemCheckoutInlineAttach(
  options: CreemCheckoutOptions,
): (node: HTMLElement) => () => void {
  return (node: HTMLElement) => {
    const handle: CreemCheckoutInlineHandle = mount({
      ...options,
      container: node,
    });
    return () => handle.destroy();
  };
}
