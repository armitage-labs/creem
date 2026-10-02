// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from "svelte";
import { fromStore, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BillingEmail from "./BillingEmail.svelte";
import {
  CREEM_CONVEX_CONTEXT_KEY,
  type CreemConvexContextValue,
} from "../creemConvexContext.js";
import type {
  BillingPermissions,
  ConnectedBillingApi,
  ConnectedBillingModel,
} from "./types.js";
import type { BillingEmailResult } from "../../core/types.js";

const convex = vi.hoisted(() => {
  const action = vi.fn();
  return { action, client: { action } };
});

// A store read through `fromStore` is reactive inside the component, like the
// live `useQuery` result.
const modelStore = writable<ConnectedBillingModel | undefined>(undefined);
const model = fromStore(modelStore);

vi.mock("convex-svelte", () => ({
  useQuery: () => ({
    get data() {
      return model.current;
    },
  }),
  useConvexClient: () => convex.client,
}));

// Function references are opaque to the widget; strings stand in for them.
const billingApi = {
  uiModel: "uiModel",
  checkouts: { create: "checkoutsCreate" },
  customers: {
    billingEmail: "customersBillingEmail",
    updateBillingEmail: "customersUpdateBillingEmail",
  },
} as unknown as ConnectedBillingApi;

const modelFor = (
  entityId: string,
  hasCreemCustomer = true,
): ConnectedBillingModel =>
  ({
    hasCreemCustomer,
    snapshot: { entityId },
  }) as unknown as ConnectedBillingModel;

const ok = (email: string): BillingEmailResult => ({ status: "ok", email });

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
  flushSync();
};

let target: HTMLDivElement;
let component: ReturnType<typeof mount> | undefined;

const render = async (permissions?: BillingPermissions) => {
  const provider: CreemConvexContextValue = { api: billingApi, permissions };
  component = mount(BillingEmail, {
    target,
    props: {},
    context: new Map([[CREEM_CONVEX_CONTEXT_KEY, provider]]),
  });
  await settle();
};

const input = () => target.querySelector("input");
const button = () => target.querySelector("button");

const type = async (value: string) => {
  const element = input();
  if (!element) throw new Error("input not rendered");
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
};

const submit = async () => {
  target
    .querySelector("form")
    ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
};

beforeEach(() => {
  convex.action.mockReset();
  modelStore.set(undefined);
  target = document.createElement("div");
  document.body.append(target);
});

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  target.remove();
});

describe("<BillingEmail> (Svelte)", () => {
  it("renders nothing before the entity has a Creem customer", async () => {
    modelStore.set(modelFor("org_1", false));
    await render();

    expect(target.querySelector("section")).toBeNull();
    expect(convex.action).not.toHaveBeenCalled();
  });

  it("renders nothing when canManageBillingEmail is false", async () => {
    modelStore.set(modelFor("org_1"));
    await render({ canManageBillingEmail: false });

    expect(target.querySelector("section")).toBeNull();
    expect(convex.action).not.toHaveBeenCalled();
  });

  it("loads the email, enables save only for a valid change, and saves it", async () => {
    modelStore.set(modelFor("org_1"));
    convex.action.mockImplementation(
      async (ref: string, args: { email?: string }) =>
        ref === "customersBillingEmail"
          ? ok("billing@example.com")
          : ok(args.email ?? ""),
    );
    await render();

    expect(input()?.value).toBe("billing@example.com");
    expect(input()?.getAttribute("aria-label")).toBe("Billing email address");
    expect(button()?.disabled).toBe(true);

    await type("accounts@");
    expect(button()?.disabled).toBe(true);
    expect(input()?.getAttribute("aria-invalid")).toBe("true");

    await type("accounts@example.com");
    expect(button()?.disabled).toBe(false);

    await submit();

    expect(convex.action).toHaveBeenCalledWith("customersUpdateBillingEmail", {
      email: "accounts@example.com",
    });
    expect(target.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      "Billing email updated.",
    );
    expect(button()?.disabled).toBe(true);
  });

  it("shows the save error and keeps the form editable", async () => {
    modelStore.set(modelFor("org_1"));
    convex.action.mockImplementation(async (ref: string) => {
      if (ref === "customersBillingEmail") return ok("billing@example.com");
      throw new Error("Conflict");
    });
    await render();

    await type("taken@example.com");
    await submit();

    expect(target.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      "Could not update the billing email",
    );
    expect(input()?.disabled).toBe(false);
    expect(button()?.disabled).toBe(false);
  });

  it("switches to the new entity's email and ignores the old late response", async () => {
    let resolveOrg1: (result: BillingEmailResult) => void = () => {};
    convex.action
      .mockReturnValueOnce(
        new Promise<BillingEmailResult>((resolve) => {
          resolveOrg1 = resolve;
        }),
      )
      .mockResolvedValueOnce(ok("org2@example.com"));

    modelStore.set(modelFor("org_1"));
    await render();
    expect(target.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      "Loading billing email...",
    );

    modelStore.set(modelFor("org_2"));
    await settle();
    resolveOrg1(ok("org1@example.com"));
    await settle();

    expect(convex.action).toHaveBeenCalledTimes(2);
    expect(input()?.value).toBe("org2@example.com");
  });
});
