import type { CheckoutIntent } from "./types.js";

const STORAGE_KEY = "creem:pending-checkout";

/**
 * Tiny sessionStorage-based helper for the "save intent → sign in → resume" pattern.
 *
 * Usage:
 * 1. In `onBeforeCheckout`, call `pendingCheckout.save(intent)` then open sign-in
 * 2. After auth completes, call `pendingCheckout.load()` — returns the intent and auto-clears
 * 3. Resume checkout with the loaded intent (e.g. call `checkouts.create` manually)
 */
export const pendingCheckout = {
  save(intent: CheckoutIntent): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
    } catch {
      // sessionStorage unavailable (SSR, private browsing quota) — silently ignore
    }
  },

  load(): CheckoutIntent | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(STORAGE_KEY);
      return JSON.parse(raw) as CheckoutIntent;
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore
    }
  },
};
