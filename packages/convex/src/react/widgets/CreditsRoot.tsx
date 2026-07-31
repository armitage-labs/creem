import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConvex } from "convex/react";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";
import { CreditsContext, type CreditsContextValue } from "./creditsContext.js";
import {
  CreditsAmount,
  CreditsError,
  CreditsRefresh,
  CreditsTitle,
} from "./CreditsSlots.js";
import { resolveBillingI18n } from "../../core/i18n.js";
import { getConvexErrorMessage } from "../../core/convexError.js";

export const CreditsRoot = ({
  unitLabel = "credits",
  className,
  class: classProp,
  children,
}: {
  unitLabel?: string;
  class?: string;
  className?: string;
  children?: ReactNode | ((credits: CreditsContextValue) => ReactNode);
}) => {
  const provider = useCreemConvex();
  const i18n = useMemo(
    () => resolveBillingI18n(provider?.i18n),
    [provider?.i18n],
  );
  const resolvedApi = requireCreemConvexApi("Credits.Root", provider);
  const client = useConvex();
  const getBalanceRef = resolvedApi.credits?.getBalance;

  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Internal loader. `isCurrent` lets the initial load bail out if the widget
  // unmounted before the balance arrived. It is deliberately NOT exposed on the
  // public `refresh`: that is typed `() => Promise<void>`, so a consumer writing
  // `onClick={credits.refresh}` would pass a DOM event into this slot and every
  // `isCurrent()` call — including the ones in `catch` and `finally` — would
  // throw a TypeError, surfacing as an unhandled rejection with no error UI.
  const loadBalance = useCallback(
    async (isCurrent: () => boolean) => {
      if (!getBalanceRef) {
        setError(i18n.labels.credits.apiNotConfigured);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await client.action(getBalanceRef, {});
        if (!isCurrent()) return;
        setBalance(result?.balance ?? "0");
      } catch (cause) {
        if (!isCurrent()) return;
        setError(getConvexErrorMessage(cause, i18n.labels.credits.loadFailed));
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [client, getBalanceRef, i18n.labels.credits],
  );

  const refresh = useCallback(() => loadBalance(() => true), [loadBalance]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      void loadBalance(() => active);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [loadBalance]);

  const contextValue = useMemo(
    () => ({
      balance,
      loading,
      error,
      unitLabel,
      labels: i18n.labels,
      refresh,
    }),
    [balance, error, i18n.labels, loading, refresh, unitLabel],
  );

  return (
    <CreditsContext.Provider value={contextValue}>
      <section
        className={`w-full max-w-sm space-y-4 radius-xl border border-border-subtle bg-surface-base p-6 text-foreground-default ${className ?? classProp ?? ""}`}
      >
        {typeof children === "function"
          ? children(contextValue)
          : (children ?? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <CreditsTitle />
                  <CreditsRefresh />
                </div>
                <CreditsAmount />
                <CreditsError />
              </>
            ))}
      </section>
    </CreditsContext.Provider>
  );
};
