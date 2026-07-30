import { describe, expect, it } from "vitest";
import {
  buildUpdateSummary,
  resolveTargetUpdateBehavior,
  type UpdateSummaryInput,
} from "./subscriptionUpdate.js";

const base: UpdateSummaryInput = {
  kind: "plan-switch",
  updateBehavior: "proration-charge-immediately",
  currentLabel: "Basic",
  newLabel: "Premium",
};

describe("buildUpdateSummary", () => {
  describe("plan-switch", () => {
    it("returns correct title for plan-switch", () => {
      const result = buildUpdateSummary(base);
      expect(result.title).toBe("Switch plan?");
      expect(result.confirmLabel).toBe("Confirm switch");
    });

    it("describes proration-charge-immediately", () => {
      const result = buildUpdateSummary(base);
      expect(result.description).toContain("prorated and charged immediately");
    });

    it("describes immediate proration as a refund for downgrades", () => {
      const result = buildUpdateSummary({
        ...base,
        currentPrice: 10000,
        newPrice: 5000,
      });
      expect(result.description).toContain("prorated and refunded immediately");
      expect(result.description).not.toContain("charged immediately");
    });

    it("keeps immediate proration as a charge for upgrades", () => {
      const result = buildUpdateSummary({
        ...base,
        currentPrice: 5000,
        newPrice: 10000,
      });
      expect(result.description).toContain("prorated and charged immediately");
    });

    it("describes proration-charge", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-charge",
      });
      expect(result.description).toContain(
        "prorated and applied to your next invoice",
      );
    });

    it("describes proration-none", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-none",
      });
      expect(result.description).toContain("next billing cycle");
    });

    it("describes period-end", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "period-end",
      });
      expect(result.description).toContain("current plan stays active");
    });

    it("preserves labels", () => {
      const result = buildUpdateSummary(base);
      expect(result.currentLabel).toBe("Basic");
      expect(result.newLabel).toBe("Premium");
    });
  });

  describe("unit-update", () => {
    it("returns correct title for unit-update", () => {
      const result = buildUpdateSummary({ ...base, kind: "unit-update" });
      expect(result.title).toBe("Update units?");
      expect(result.confirmLabel).toBe("Confirm update");
    });
  });

  describe("dateNote with currentPeriodEnd", () => {
    it("includes date note for proration-charge", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-charge",
        currentPeriodEnd: "2025-06-15T00:00:00Z",
      });
      expect(result.dateNote).toContain("next invoice");
      expect(result.dateNote).toContain("2025");
    });

    it("includes date note for proration-none", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-none",
        currentPeriodEnd: "2025-06-15T00:00:00Z",
      });
      expect(result.dateNote).toContain("next billing cycle");
      expect(result.dateNote).toContain("2025");
    });

    it("returns null dateNote for proration-charge-immediately", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-charge-immediately",
        currentPeriodEnd: "2025-06-15T00:00:00Z",
      });
      expect(result.dateNote).toBeNull();
    });

    it("includes date note for period-end", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "period-end",
        currentPeriodEnd: "2025-06-15T00:00:00Z",
      });
      expect(result.dateNote).toContain("scheduled change");
      expect(result.dateNote).toContain("2025");
    });

    it("returns null dateNote when no currentPeriodEnd", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-charge",
      });
      expect(result.dateNote).toBeNull();
    });

    it("returns null dateNote for invalid date", () => {
      const result = buildUpdateSummary({
        ...base,
        updateBehavior: "proration-charge",
        currentPeriodEnd: "not-a-date",
      });
      expect(result.dateNote).toBeNull();
    });
  });

  describe("trial handling", () => {
    it("returns trial description when isTrialing is true", () => {
      const result = buildUpdateSummary({
        ...base,
        isTrialing: true,
      });
      expect(result.description).toContain("trial");
      expect(result.dateNote).toBeNull();
    });

    it("includes trial end date when provided", () => {
      const result = buildUpdateSummary({
        ...base,
        isTrialing: true,
        trialEnd: "2025-07-01T00:00:00Z",
      });
      expect(result.description).toContain("trial");
      expect(result.description).toContain("2025");
    });

    it("uses generic trial message when trialEnd is null", () => {
      const result = buildUpdateSummary({
        ...base,
        isTrialing: true,
        trialEnd: null,
      });
      expect(result.description).toContain("free trial will continue");
    });

    it("handles invalid trialEnd date gracefully", () => {
      const result = buildUpdateSummary({
        ...base,
        isTrialing: true,
        trialEnd: "invalid-date",
      });
      // Falls back to generic trial message
      expect(result.description).toContain("free trial will continue");
    });

    it("returns correct confirm label for trial plan-switch", () => {
      const result = buildUpdateSummary({
        ...base,
        isTrialing: true,
      });
      expect(result.confirmLabel).toBe("Confirm switch");
    });

    it("returns correct confirm label for trial unit-update", () => {
      const result = buildUpdateSummary({
        ...base,
        kind: "unit-update",
        isTrialing: true,
      });
      expect(result.confirmLabel).toBe("Confirm update");
    });
  });
});

describe("resolveTargetUpdateBehavior", () => {
  it("defaults paid-to-free switches to period-end", () => {
    expect(
      resolveTargetUpdateBehavior(undefined, {
        appPlanId: "free",
      }),
    ).toBe("period-end");
  });

  it("keeps explicit immediate behavior for paid-to-free switches", () => {
    expect(
      resolveTargetUpdateBehavior("immediate", {
        appPlanId: "free",
      }),
    ).toBe("immediate");
  });

  it("defaults paid targets and unit updates to immediate proration", () => {
    expect(resolveTargetUpdateBehavior(undefined, {})).toBe(
      "proration-charge-immediately",
    );
  });

  it("keeps the requested behavior for paid targets and unit updates", () => {
    expect(
      resolveTargetUpdateBehavior("proration-charge-immediately", {}),
    ).toBe("proration-charge-immediately");
  });
});
