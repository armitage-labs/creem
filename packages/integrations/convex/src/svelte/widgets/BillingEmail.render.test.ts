// @vitest-environment jsdom
import { flushSync, mount, tick, unmount, type Component } from "svelte";
import { fromStore, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BillingEmail from "./BillingEmail.svelte";
import BillingEmailTitle from "./BillingEmailTitle.svelte";
import BillingEmailComposed from "./BillingEmailComposed.test.svelte";
import BillingEmailUnstyled from "./BillingEmailUnstyled.test.svelte";
import {
  CREEM_CONVEX_CONTEXT_KEY,
  type CreemConvexContextValue,
} from "../creemConvexContext.js";
import type {
  BillingPermissions,
  ConnectedBillingApi,
  ConnectedBillingModel,
} from "./types.js";
import type { BillingEmailActionResult } from "../../core/types.js";

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

const ok = (email: string): BillingEmailActionResult => ({
  status: "ok",
  email,
});

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
  flushSync();
};

let target: HTMLDivElement;
let component: ReturnType<typeof mount> | undefined;

const render = async (
  permissions?: BillingPermissions,
  widget: Component = BillingEmail,
) => {
  const provider: CreemConvexContextValue = { api: billingApi, permissions };
  component = mount(widget, {
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
      expectedEntityId: "org_1",
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

  it("reloads instead of saving when the server resolves another entity", async () => {
    modelStore.set(modelFor("org_1"));
    convex.action.mockImplementation(
      async (ref: string): Promise<BillingEmailActionResult> =>
        ref === "customersBillingEmail"
          ? ok("org1@example.com")
          : { status: "entity-changed" },
    );
    await render();

    await type("new@example.com");
    await submit();

    expect(convex.action).toHaveBeenCalledWith("customersUpdateBillingEmail", {
      expectedEntityId: "org_1",
      email: "new@example.com",
    });
    const loads = convex.action.mock.calls.filter(
      ([ref]) => ref === "customersBillingEmail",
    );
    expect(loads).toEqual([
      ["customersBillingEmail", { expectedEntityId: "org_1" }],
      ["customersBillingEmail", { expectedEntityId: "org_1" }],
    ]);
    expect(input()?.value).toBe("org1@example.com");
    expect(target.querySelector('[role="status"]')).toBeNull();
  });

  it("retries a failed load from the error state", async () => {
    modelStore.set(modelFor("org_1"));
    convex.action
      .mockRejectedValueOnce(new Error("Creem unavailable"))
      .mockResolvedValueOnce(ok("billing@example.com"));
    await render();

    expect(target.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      "Could not load the billing email",
    );
    const retry = Array.from(target.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "Try again",
    );
    expect(retry).toBeDefined();

    retry?.click();
    await settle();

    expect(input()?.value).toBe("billing@example.com");
    expect(target.querySelector('[role="alert"]')).toBeNull();
  });

  it("switches to the new entity's email and ignores the old late response", async () => {
    let resolveOrg1: (result: BillingEmailActionResult) => void = () => {};
    convex.action
      .mockReturnValueOnce(
        new Promise<BillingEmailActionResult>((resolve) => {
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

describe("<BillingEmail> composition (Svelte)", () => {
  const loadThenFailSave = () =>
    convex.action.mockImplementation(async (ref: string) => {
      if (ref === "customersBillingEmail") return ok("billing@example.com");
      throw new Error("Conflict");
    });

  it("throws a clear error for a part outside BillingEmail.Root", () => {
    expect(() => mount(BillingEmailTitle, { target })).toThrow(
      "BillingEmail parts must be used inside <BillingEmail.Root>.",
    );
  });

  it("wires names and descriptions in the default layout", async () => {
    modelStore.set(modelFor("org_1"));
    loadThenFailSave();
    await render();

    const form = target.querySelector("form");
    const title = target.querySelector("h3");
    const description = target.querySelector("p");
    expect(form?.getAttribute("aria-labelledby")).toBe(title?.id);
    expect(input()?.getAttribute("aria-label")).toBe("Billing email address");
    expect(input()?.getAttribute("aria-describedby")).toBe(description?.id);

    await type("taken@example.com");
    await submit();

    const error = target.querySelector('[role="alert"]');
    expect(input()?.getAttribute("aria-describedby")).toBe(
      `${description?.id} ${error?.id}`,
    );
  });

  it("supports a custom layout with a visible label and forwarded attributes", async () => {
    modelStore.set(modelFor("org_1"));
    loadThenFailSave();
    await render(undefined, BillingEmailComposed);

    const label = target.querySelector("label");
    expect(label?.textContent?.trim()).toBe("Invoice address");
    expect(label?.getAttribute("for")).toBe(input()?.id);
    expect(input()?.hasAttribute("aria-label")).toBe(false);
    expect(input()?.getAttribute("aria-describedby")).toBeNull();
    expect(input()?.dataset.testid).toBe("email");
    expect(input()?.className).toContain("creem-base:input-default");
    expect(input()?.className).toContain("custom-input");
    expect(target.querySelector("form")?.className).toContain("custom-root");
    expect(target.querySelector("h3")).toBeNull();

    await type("taken@example.com");
    expect(button()?.textContent?.trim()).toBe("Update");
    await submit();

    const error = target.querySelector('[role="alert"]');
    expect(error?.textContent?.trim()).toBe(
      "Could not update the billing email",
    );
    expect(input()?.getAttribute("aria-describedby")).toBe(error?.id);
  });

  it("keeps only the caller's classes when unstyled", async () => {
    modelStore.set(modelFor("org_1"));
    convex.action.mockResolvedValue(ok("billing@example.com"));
    await render(undefined, BillingEmailUnstyled);

    expect(target.innerHTML).not.toContain("creem-base:");
    expect(input()?.value).toBe("billing@example.com");
  });

  it("explains a malformed address after the input loses focus", async () => {
    modelStore.set(modelFor("org_1"));
    convex.action.mockResolvedValue(ok("billing@example.com"));
    await render();

    await type("accounts@");
    expect(target.querySelector('[role="alert"]')).toBeNull();

    input()?.dispatchEvent(new FocusEvent("blur"));
    await settle();

    const error = target.querySelector('[role="alert"]');
    expect(error?.textContent?.trim()).toBe("Enter a valid email address.");
    expect(input()?.getAttribute("aria-describedby")).toContain(error?.id);
  });
});
