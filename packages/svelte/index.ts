import {
  openCheckout,
  mount,
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
