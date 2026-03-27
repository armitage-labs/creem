import { describe, expect, it } from "vitest";
import {
  buildUpdateSummary,
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

    it("preserves labels", () => {
      const result = buildUpdateSummary(base);
      expect(result.currentLabel).toBe("Basic");
      expect(result.newLabel).toBe("Premium");
    });
  });

  describe("seat-update", () => {
    it("returns correct title for seat-update", () => {
      const result = buildUpdateSummary({ ...base, kind: "seat-update" });
      expect(result.title).toBe("Update seats?");
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

    it("returns correct confirm label for trial seat-update", () => {
      const result = buildUpdateSummary({
        ...base,
        kind: "seat-update",
        isTrialing: true,
      });
      expect(result.confirmLabel).toBe("Confirm update");
    });
  });
});
