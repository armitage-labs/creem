import type { UpdateBehavior } from "./types.js";

export type UpdateSummaryInput = {
  kind: "plan-switch" | "seat-update";
  updateBehavior: UpdateBehavior;
  currentLabel: string;
  newLabel: string;
  currentPeriodEnd?: string | null;
  isTrialing?: boolean;
  trialEnd?: string | null;
};

export type UpdateSummary = {
  title: string;
  description: string;
  currentLabel: string;
  newLabel: string;
  dateNote: string | null;
  confirmLabel: string;
};

const getBehaviorDescription = (updateBehavior: UpdateBehavior): string => {
  switch (updateBehavior) {
    case "proration-charge-immediately":
      return "The price difference will be prorated and charged immediately.";
    case "proration-charge":
      return "The price difference will be prorated and applied to your next invoice.";
    case "proration-none":
      return "The new price will take effect at your next billing cycle.";
  }
};

const formatPeriodEnd = (
  iso: string,
  updateBehavior: UpdateBehavior,
): string | null => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (updateBehavior === "proration-charge") {
    return `Your next invoice is on ${formatted}.`;
  }
  if (updateBehavior === "proration-none") {
    return `Your next billing cycle starts on ${formatted}.`;
  }
  return null;
};

const formatTrialEnd = (iso: string): string | null => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Your trial continues until ${formatted}. The new price will apply once the trial ends.`;
};

export const buildUpdateSummary = (
  input: UpdateSummaryInput,
): UpdateSummary => {
  const {
    kind,
    updateBehavior,
    currentLabel,
    newLabel,
    currentPeriodEnd,
    isTrialing,
    trialEnd,
  } = input;

  if (isTrialing) {
    const trialNote = trialEnd ? formatTrialEnd(trialEnd) : null;
    return {
      title: kind === "plan-switch" ? "Switch plan?" : "Update seats?",
      description:
        trialNote ??
        "Your free trial will continue. The new price will take effect once the trial ends.",
      currentLabel,
      newLabel,
      dateNote: null,
      confirmLabel:
        kind === "plan-switch" ? "Confirm switch" : "Confirm update",
    };
  }

  return {
    title: kind === "plan-switch" ? "Switch plan?" : "Update seats?",
    description: getBehaviorDescription(updateBehavior),
    currentLabel,
    newLabel,
    dateNote: currentPeriodEnd
      ? formatPeriodEnd(currentPeriodEnd, updateBehavior)
      : null,
    confirmLabel: kind === "plan-switch" ? "Confirm switch" : "Confirm update",
  };
};
