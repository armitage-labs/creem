import { describe, expect, it } from "vitest";
import { evaluateUsageLimits } from "./usageLimits.js";
import { normalizePlanCatalog } from "./catalog.js";
import type { PlanCatalog } from "./types.js";

const makeCatalog = (limits?: Record<string, number>): PlanCatalog =>
  normalizePlanCatalog({
    version: "1",
    plans: [
      {
        planId: "basic",
        category: "paid",
        limits,
      },
      {
        planId: "pro",
        category: "paid",
        limits: { aiMessages: 100, projects: 50 },
      },
      {
        planId: "free",
        category: "free",
        limits: { aiMessages: 5 },
      },
    ],
  })!;

describe("evaluateUsageLimits", () => {
  it("reports under-limit correctly", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog({ aiMessages: 10 }),
      planId: "basic",
      usage: { aiMessages: 3 },
    });

    expect(result.aiMessages).toEqual({
      used: 3,
      limit: 10,
      exceeded: false,
    });
  });

  it("reports at-limit as exceeded", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog({ aiMessages: 5 }),
      planId: "basic",
      usage: { aiMessages: 5 },
    });

    expect(result.aiMessages).toEqual({
      used: 5,
      limit: 5,
      exceeded: true,
    });
  });

  it("reports over-limit as exceeded", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog({ aiMessages: 5 }),
      planId: "basic",
      usage: { aiMessages: 7 },
    });

    expect(result.aiMessages).toEqual({
      used: 7,
      limit: 5,
      exceeded: true,
    });
  });

  it("reports unlimited for usage keys not defined in plan limits", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog({ aiMessages: 10 }),
      planId: "basic",
      usage: { aiMessages: 3, projects: 12 },
    });

    expect(result.projects).toEqual({
      used: 12,
      limit: Infinity,
      exceeded: false,
    });
  });

  it("reports unlimited when plan has no limits defined", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog(),
      planId: "basic",
      usage: { aiMessages: 100 },
    });

    expect(result.aiMessages).toEqual({
      used: 100,
      limit: Infinity,
      exceeded: false,
    });
  });

  it("handles multiple limit keys", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog(),
      planId: "pro",
      usage: { aiMessages: 50, projects: 60 },
    });

    expect(result.aiMessages).toEqual({
      used: 50,
      limit: 100,
      exceeded: false,
    });
    expect(result.projects).toEqual({
      used: 60,
      limit: 50,
      exceeded: true,
    });
  });

  it("handles unknown plan ID gracefully", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog(),
      planId: "nonexistent",
      usage: { aiMessages: 10 },
    });

    expect(result.aiMessages).toEqual({
      used: 10,
      limit: Infinity,
      exceeded: false,
    });
  });

  it("returns empty result for empty usage", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog({ aiMessages: 5 }),
      planId: "basic",
      usage: {},
    });

    expect(result).toEqual({});
  });

  it("works with free plan limits", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog(),
      planId: "free",
      usage: { aiMessages: 5 },
    });

    expect(result.aiMessages).toEqual({
      used: 5,
      limit: 5,
      exceeded: true,
    });
  });

  it("reports zero usage correctly", () => {
    const result = evaluateUsageLimits({
      catalog: makeCatalog({ aiMessages: 10 }),
      planId: "basic",
      usage: { aiMessages: 0 },
    });

    expect(result.aiMessages).toEqual({
      used: 0,
      limit: 10,
      exceeded: false,
    });
  });
});
