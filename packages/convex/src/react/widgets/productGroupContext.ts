import { createContext } from "react";
import type { ProductItemRegistration } from "./types.js";

export type ProductGroupContextValue = {
  registerItem: (item: ProductItemRegistration) => () => void;
};

export const ProductGroupContext = createContext<
  ProductGroupContextValue | undefined
>(undefined);
