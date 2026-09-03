import { describe, expect, it, vi } from "vitest";
import {
  resolveUpdateFailureAfterResume,
  resumeSubscriptionIfNeeded,
} from "./subscriptionLifecycle.js";

const createSdk = (status: string) => ({
  subscriptions: {
    get: vi.fn(async () => ({ status })),
    resume: vi.fn(async () => undefined),
  },
});

describe("resumeSubscriptionIfNeeded", () => {
  it.each(["scheduled_cancel", "paused"])(
    "resumes a %s subscription",
    async (status) => {
      const sdk = createSdk(status);

      await expect(resumeSubscriptionIfNeeded(sdk, "sub_1")).resolves.toBe(
        true,
      );
      expect(sdk.subscriptions.resume).toHaveBeenCalledOnce();
      expect(sdk.subscriptions.resume).toHaveBeenCalledWith("sub_1");
    },
  );

  it("recognizes an already active subscription without another resume call", async () => {
    const sdk = createSdk("active");

    await expect(resumeSubscriptionIfNeeded(sdk, "sub_1")).resolves.toBe(true);
    expect(sdk.subscriptions.resume).not.toHaveBeenCalled();
  });
});

describe("resolveUpdateFailureAfterResume", () => {
  it("keeps local state active after Creem resumed but the update failed", () => {
    expect(
      resolveUpdateFailureAfterResume({
        cancellationWasCleared: true,
        previousStatus: "scheduled_cancel",
        previousCancelAtPeriodEnd: true,
      }),
    ).toEqual({
      previousStatus: "active",
      previousCancelAtPeriodEnd: false,
      restoreAppPlanTransitions: false,
    });
  });

  it("restores the scheduled transition when resume itself failed", () => {
    expect(
      resolveUpdateFailureAfterResume({
        cancellationWasCleared: false,
        previousStatus: "scheduled_cancel",
        previousCancelAtPeriodEnd: true,
      }),
    ).toEqual({
      previousStatus: "scheduled_cancel",
      previousCancelAtPeriodEnd: true,
      restoreAppPlanTransitions: true,
    });
  });
});
