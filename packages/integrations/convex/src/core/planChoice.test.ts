import { describe, expect, it } from "vitest";
import { choosablePlans, initialChoice } from "./planChoice.js";
import type { UIPlanEntry } from "./types.js";

const plan = (planId: string, extra: Partial<UIPlanEntry> = {}): UIPlanEntry =>
  ({
    planId,
    category: "paid",
    billingCycles: ["every-month", "every-year"],
    creemProductIds: {
      "every-month": `${planId}_monthly`,
      "every-year": `${planId}_yearly`,
    },
    ...extra,
  }) as UIPlanEntry;

describe("choosablePlans", () => {
  it("offers the paid plans with their product at the selected cycle", () => {
    const options = choosablePlans(
      [
        plan("free", { category: "free", creemProductIds: undefined }),
        plan("trial", { category: "trial" }),
        plan("basic"),
        plan("pro"),
        plan("enterprise", { category: "enterprise" }),
      ],
      "every-year",
    );
    expect(
      options.map((option) => [option.plan.planId, option.productId]),
    ).toEqual([
      ["basic", "basic_yearly"],
      ["pro", "pro_yearly"],
    ]);
  });

  it("marks the subscribed product as current", () => {
    const options = choosablePlans(
      [plan("basic"), plan("pro")],
      "every-month",
      "pro_monthly",
    );
    expect(options.map((option) => option.current)).toEqual([false, true]);
  });
});

describe("initialChoice", () => {
  const options = choosablePlans(
    [plan("basic"), plan("pro", { recommended: true }), plan("max")],
    "every-month",
    "basic_monthly",
  );

  it("takes the requested plan, else the recommended one", () => {
    expect(initialChoice(options, "max")).toBe("max");
    expect(initialChoice(options)).toBe("pro");
  });

  it("never starts on the current plan", () => {
    expect(initialChoice(options, "basic")).toBe("pro");
    expect(
      initialChoice(
        choosablePlans([plan("basic")], "every-month", "basic_monthly"),
      ),
    ).toBeNull();
  });
});
