import { describe, expect, it } from "vitest";
import {
  defaultBillingLabels,
  mergeBillingLabels,
  resolveBillingI18n,
} from "./i18n.js";

describe("billing i18n", () => {
  it("keeps English defaults when no overrides are provided", () => {
    const i18n = resolveBillingI18n();

    expect(i18n.labels.subscription.currentPlan).toBe("Current plan");
    expect(i18n.labels.billingHistory.columns.amount).toBe("Amount");
    expect(i18n.labels.subscription.unitCount(3)).toBe("3 units");
  });

  it("deep-merges label overrides without replacing sibling namespaces", () => {
    const labels = mergeBillingLabels({
      subscription: {
        currentPlan: "Aktueller Tarif",
        unitCount: (units) => `${units} Einheit${units === 1 ? "" : "en"}`,
      },
      billingHistory: {
        title: "Rechnungsverlauf",
      },
    });

    expect(labels.subscription.currentPlan).toBe("Aktueller Tarif");
    expect(labels.subscription.subscribe).toBe(
      defaultBillingLabels.subscription.subscribe,
    );
    expect(labels.subscription.unitCount(2)).toBe("2 Einheiten");
    expect(labels.billingHistory.title).toBe("Rechnungsverlauf");
    expect(labels.billingHistory.columns.status).toBe("Status");
  });

  it("uses custom date and currency formatters", () => {
    const i18n = resolveBillingI18n({
      locale: "de-DE",
      formatCurrency: ({ amount, currency }) => `${amount}:${currency}`,
      formatDate: ({ date }) => `date:${date.getUTCFullYear()}`,
    });

    expect(i18n.formatCurrency({ amount: 1200, currency: "EUR" })).toBe(
      "1200:EUR",
    );
    expect(
      i18n.formatDate({ date: new Date("2026-05-14T00:00:00.000Z") }),
    ).toBe("date:2026");
  });

  it("formats cancel descriptions with an optional period end date", () => {
    const description =
      defaultBillingLabels.subscription.dialogs.cancelDescription({
        formattedDate: "Jun 18, 2026",
      });

    expect(description).toContain("Jun 18, 2026");
    expect(
      defaultBillingLabels.subscription.dialogs.cancelDescription({}),
    ).toContain("current billing period.");
  });
});
