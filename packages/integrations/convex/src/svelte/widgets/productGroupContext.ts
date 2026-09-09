import type { ProductItemRegistration } from "./types.js";

export type ProductGroupContextValue = {
  registerItem: (item: ProductItemRegistration) => () => void;
};

export const PRODUCT_GROUP_CONTEXT_KEY = Symbol("creem.product.group.context");
