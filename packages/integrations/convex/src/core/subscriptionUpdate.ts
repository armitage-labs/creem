import type { AppPlanUpdateBehavior, ResolvedUpdateBehavior } from "./types.js";
import {
  defaultBillingLabels,
  type BillingLabels,
  type BillingDateFormatInput,
} from "./i18n.js";

export type UpdateSummaryInput = {
  kind: "plan-switch" | "unit-update";
  updateBehavior: ResolvedUpdateBehavior;
  currentLabel: string;
  newLabel: string;
  currentPrice?: number | null;
  newPrice?: number | null;
  currentCaption?: string | null;
  newCaption?: string | null;
  currentPeriodEnd?: string | null;
  isTrialing?: boolean;
  trialEnd?: string | null;
  labels?: BillingLabels;
  formatDate?: (input: BillingDateFormatInput) => string;
};

export type UpdateSummary = {
  title: string;
  description: string;
  currentLabel: string;
  newLabel: string;
  currentCaption: string | null;
  newCaption: string | null;
  dateNote: string | null;
  confirmLabel: string;
};

export const resolveTargetUpdateBehavior = (
  updateBehavior: ResolvedUpdateBehavior | undefined,
  target: { appPlanId?: string | null },
): ResolvedUpdateBehavior => {
  return (
    updateBehavior ??
    (target.appPlanId ? "period-end" : "proration-charge-immediately")
  );
};

export const resolveAppPlanUpdateBehavior = (
  updateBehavior: AppPlanUpdateBehavior | undefined,
): AppPlanUpdateBehavior => updateBehavior ?? "period-end";

const formatPeriodEnd = (
  iso: string,
  updateBehavior: ResolvedUpdateBehavior,
  labels: BillingLabels,
  formatDate?: (input: BillingDateFormatInput) => string,
): string | null => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const formatted = (formatDate ?? defaultBillingDateFormatter)({
    date,
  });
  return labels.subscription.dialogs.periodEndNote({
    behavior: updateBehavior,
    formattedDate: formatted,
  });
};

const defaultBillingDateFormatter = ({ date }: BillingDateFormatInput) =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatTrialEnd = (
  iso: string,
  labels: BillingLabels,
  formatDate?: (input: BillingDateFormatInput) => string,
): string | null => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const formatted = (formatDate ?? defaultBillingDateFormatter)({
    date,
  });
  return labels.subscription.dialogs.trialEndNote(formatted);
};

export const buildUpdateSummary = (
  input: UpdateSummaryInput,
): UpdateSummary => {
  const {
    kind,
    updateBehavior,
    currentLabel,
    newLabel,
    currentPrice,
    newPrice,
    currentCaption = null,
    newCaption = null,
    currentPeriodEnd,
    isTrialing,
    trialEnd,
    labels = defaultBillingLabels,
    formatDate,
  } = input;

  if (isTrialing) {
    const trialNote = trialEnd
      ? formatTrialEnd(trialEnd, labels, formatDate)
      : null;
    return {
      title:
        kind === "plan-switch"
          ? labels.subscription.dialogs.switchPlanTitle
          : labels.subscription.dialogs.updateUnitsTitle,
      description: trialNote ?? labels.subscription.dialogs.trialContinues,
      currentLabel,
      newLabel,
      currentCaption,
      newCaption,
      dateNote: null,
      confirmLabel:
        kind === "plan-switch"
          ? labels.subscription.dialogs.confirmSwitch
          : labels.subscription.dialogs.confirmUpdate,
    };
  }

  return {
    title:
      kind === "plan-switch"
        ? labels.subscription.dialogs.switchPlanTitle
        : labels.subscription.dialogs.updateUnitsTitle,
    description: labels.subscription.dialogs.behaviorDescription(
      updateBehavior,
      {
        isDowngrade:
          currentPrice != null && newPrice != null && newPrice < currentPrice,
      },
    ),
    currentLabel,
    newLabel,
    currentCaption,
    newCaption,
    dateNote: currentPeriodEnd
      ? formatPeriodEnd(currentPeriodEnd, updateBehavior, labels, formatDate)
      : null,
    confirmLabel:
      kind === "plan-switch"
        ? labels.subscription.dialogs.confirmSwitch
        : labels.subscription.dialogs.confirmUpdate,
  };
};
