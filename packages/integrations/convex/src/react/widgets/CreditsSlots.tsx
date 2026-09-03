import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useCredits } from "./creditsContext.js";

export const CreditsTitle = ({
  className = "title-s text-foreground-default",
  class: classProp,
  children,
}: {
  class?: string;
  className?: string;
  children?: ReactNode;
}) => {
  const credits = useCredits();
  return (
    <h3 className={classProp ?? className}>
      {children ?? credits.labels.credits.title}
    </h3>
  );
};

export const CreditsAmount = ({
  className = "flex items-baseline gap-2",
  class: classProp,
  amountClassName = "heading-s tabular-nums text-foreground-default",
  unitClassName = "label-m text-foreground-muted",
}: {
  class?: string;
  className?: string;
  amountClassName?: string;
  unitClassName?: string;
}) => {
  const credits = useCredits();
  if (credits.loading && credits.balance === null) {
    return (
      <div className="body-m py-3 text-foreground-muted">
        {credits.labels.credits.loading}
      </div>
    );
  }
  return (
    <div className={classProp ?? className}>
      <span className={amountClassName}>{credits.balance ?? "-"}</span>
      <span className={unitClassName}>{credits.unitLabel}</span>
    </div>
  );
};

export const CreditsRefresh = ({
  className = "icon-button-ghost-sm",
  class: classProp,
  label,
}: {
  class?: string;
  className?: string;
  label?: string;
}) => {
  const credits = useCredits();
  return (
    <button
      type="button"
      className={classProp ?? className}
      onClick={() => void credits.refresh()}
      disabled={credits.loading}
      aria-label={label ?? credits.labels.credits.refreshBalance}
    >
      <RefreshCw
        aria-hidden="true"
        className={`size-4 ${credits.loading ? "animate-spin" : ""}`}
      />
    </button>
  );
};

export const CreditsError = ({
  className = "body-m radius-m border border-error-border-subtle bg-error-surface-subtle px-3 py-2 text-error-foreground-default",
  class: classProp,
}: {
  class?: string;
  className?: string;
}) => {
  const credits = useCredits();
  return credits.error ? (
    <div className={classProp ?? className}>{credits.error}</div>
  ) : null;
};

export const CreditsStatus = ({
  className = "label-s text-foreground-muted",
  class: classProp,
  loadingLabel,
  idleLabel = "",
}: {
  class?: string;
  className?: string;
  loadingLabel?: string;
  idleLabel?: string;
}) => {
  const credits = useCredits();
  if (!credits.loading && !idleLabel) return null;
  return (
    <div className={classProp ?? className}>
      {credits.loading
        ? (loadingLabel ?? credits.labels.credits.refreshing)
        : idleLabel}
    </div>
  );
};
