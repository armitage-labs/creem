// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from "svelte";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import BillingPortal from "./BillingPortal.svelte";
import {
  CREEM_CONVEX_CONTEXT_KEY,
  type CreemConvexContextValue,
} from "../creemConvexContext.js";
import type { ConnectedBillingApi } from "./types.js";

const convex = vi.hoisted(() => {
  const action = vi.fn();
  return { action, client: { action } };
});

vi.mock("convex-svelte", () => ({
  useQuery: () => ({ data: { hasCreemCustomer: true } }),
  useConvexClient: () => convex.client,
}));

const billingApi = {
  uiModel: "uiModel",
  checkouts: { create: "checkoutsCreate" },
  customers: { portalUrl: "customersPortalUrl" },
} as unknown as ConnectedBillingApi;

let component: ReturnType<typeof mount> | undefined;
let target: HTMLDivElement;

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  target?.remove();
});

describe("<BillingPortal> (Svelte)", () => {
  it("explains a portal refused for a shared Creem customer", async () => {
    convex.action.mockRejectedValue(
      new ConvexError({ code: "shared-customer", message: "server text" }),
    );
    target = document.createElement("div");
    document.body.append(target);
    const provider: CreemConvexContextValue = { api: billingApi };
    component = mount(BillingPortal, {
      target,
      props: {},
      context: new Map([[CREEM_CONVEX_CONTEXT_KEY, provider]]),
    });
    flushSync();

    target.querySelector("button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
    flushSync();

    expect(target.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      "This billing contact is shared with another account, so the billing portal isn't available here.",
    );
  });
});
