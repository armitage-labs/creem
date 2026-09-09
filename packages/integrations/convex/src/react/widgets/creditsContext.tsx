import { createContext, useContext } from "react";
import type { BillingLabels } from "../../core/i18n.js";

/**
 * The value `Credits.Root` provides to its slots: balance, loading and error
 * state, and `refresh()`.
 */
export interface CreditsContextValue {
  balance: string | null;
  loading: boolean;
  error: string | null;
  unitLabel: string;
  labels: BillingLabels;
  refresh: () => Promise<void>;
}

export const CreditsContext = createContext<CreditsContextValue | null>(null);

/**
 * Reads the `Credits.Root` context: balance, loading and error state, and
 * `refresh()`.
 *
 * @throws When called outside a `Credits.Root`.
 */
export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error("Credits slots must be used inside <Credits.Root>.");
  }
  return context;
};
