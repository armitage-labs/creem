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

  // `isCurrent` lets the initial load bail out if the widget unmounted before
  // the balance arrived. It defaults to "always current" so `refresh` keeps the
  // plain `() => Promise<void>` signature the Credits context exposes; repeat
  // presses are already blocked by the button's `disabled={loading}`.
  const refresh = useCallback(
    async (isCurrent: () => boolean = () => true) => {
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

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      void refresh(() => active);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [refresh]);

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
