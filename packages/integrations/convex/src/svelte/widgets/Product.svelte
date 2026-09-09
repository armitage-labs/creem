<script lang="ts">
  import { getContext, untrack } from "svelte";
  import {
    PRODUCT_GROUP_CONTEXT_KEY,
    type ProductGroupContextValue,
  } from "./productGroupContext.js";
  import type { ProductType } from "./types.js";

  interface Props {
    /** Creem product ID represented by this product item. */
    productId: string;
    /** One-time products become owned after purchase; recurring products can be purchased repeatedly. */
    type: ProductType;
    /** Display title. Defaults to synced Creem product name. */
    title?: string;
    /** Display description. Defaults to synced Creem product description. */
    description?: string;
  }

  let {
    productId,
    type,
    title = undefined,
    description = undefined,
  }: Props = $props();

  // Must be used inside a <Product.Root>
  const rootContext = getContext<ProductGroupContextValue | undefined>(
    PRODUCT_GROUP_CONTEXT_KEY,
  );

  if (rootContext) {
    $effect(() => {
      const registration = {
        productId,
        type,
        title,
        description,
      };
      const unregister = untrack(() => rootContext.registerItem(registration));
      return () => untrack(unregister);
    });
  }
</script>
