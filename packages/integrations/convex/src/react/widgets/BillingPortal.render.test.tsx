// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreemConvexProvider } from "../CreemConvexProvider.js";
import { BillingPortal } from "./index.js";
import type { ConnectedBillingApi, ConnectedBillingModel } from "./types.js";

const convex = vi.hoisted(() => {
  const action = vi.fn();
  return { action, client: { action } };
});

vi.mock("convex/react", () => ({
  useQuery: () => ({ hasCreemCustomer: true }) as ConnectedBillingModel,
  useConvex: () => convex.client,
}));

const billingApi = {
  uiModel: "uiModel",
  checkouts: { create: "checkoutsCreate" },
  customers: { portalUrl: "customersPortalUrl" },
} as unknown as ConnectedBillingApi;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  convex.action.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("<BillingPortal> (React)", () => {
  it("explains a portal refused for a shared Creem customer", async () => {
    convex.action.mockRejectedValue(
      new ConvexError({ code: "shared-customer", message: "server text" }),
    );
    await act(async () => {
      root.render(
        <CreemConvexProvider api={billingApi}>
          <BillingPortal />
        </CreemConvexProvider>,
      );
    });

    await act(async () => container.querySelector("button")?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This billing contact is shared with another account, so the billing portal isn't available here.",
    );
  });
});
