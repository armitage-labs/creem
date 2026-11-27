import { issue } from "./plan";
import type { MigrationIssue } from "./report";

/**
 * Billing rules shared by the migrators: a source interval as Creem's billing
 * period (a preset, or `custom` within Creem's bounds), and a trial in days.
 */
type Preset =
  | "every-day"
  | "every-month"
  | "every-three-months"
  | "every-six-months"
  | "every-year";
type Interval = "day" | "week" | "month" | "year";
const CUSTOM_MAX: Record<Interval, number> = { day: 365, week: 52, month: 24, year: 3 };

export function billing(
  unit: string | null | undefined,
  count: number | null | undefined,
):
  | { billingPeriod: Preset }
  | { billingPeriod: "custom"; recurringInterval: Interval; recurringIntervalCount: number }
  | { skip: MigrationIssue } {
  const n = count ?? 1;
  const presets: Record<string, Preset> = {
    "day:1": "every-day",
    "month:1": "every-month",
    "month:3": "every-three-months",
    "month:6": "every-six-months",
    "year:1": "every-year",
  };
  if (!unit)
    return {
      skip: issue("billing_interval_unsupported", "The subscription has no billing interval."),
    };
  const preset = presets[`${unit}:${n}`];
  if (preset) return { billingPeriod: preset };
  if (unit in CUSTOM_MAX && Number.isInteger(n) && n >= 1 && n <= CUSTOM_MAX[unit as Interval])
    return {
      billingPeriod: "custom",
      recurringInterval: unit as Interval,
      recurringIntervalCount: n,
    };
  return {
    skip: issue(
      "billing_interval_unsupported",
      `Billing every ${n} ${unit}(s) is outside what Creem supports (day 1–365, week 1–52, month 1–24, year 1–3).`,
    ),
  };
}

export function trialDays(
  unit: string | null | undefined,
  count: number | null | undefined,
  warnings: MigrationIssue[],
): number | undefined {
  if (!unit || !count) return undefined;
  if (unit === "day") return count;
  if (unit === "week") return count * 7;
  const days = unit === "month" ? count * 30 : unit === "year" ? count * 365 : undefined;
  if (days === undefined) return undefined;
  warnings.push(
    issue(
      "trial_not_in_days",
      `The ${count}-${unit} trial becomes ${days} days: Creem trials are counted in days.`,
    ),
  );
  return days;
}
