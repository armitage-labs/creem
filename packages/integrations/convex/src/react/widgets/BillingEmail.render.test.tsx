// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreemConvexProvider } from "../CreemConvexProvider.js";
import { BillingEmail } from "./BillingEmail.js";
import type {
  BillingPermissions,
  ConnectedBillingApi,
  ConnectedBillingModel,
} from "./types.js";
import type { BillingEmailActionResult } from "../../core/types.js";

const convex = vi.hoisted(() => {
  const action = vi.fn();
  // `useConvex` returns one stable client, like the real provider.
  return { model: undefined as unknown, action, client: { action } };
});

vi.mock("convex/react", () => ({
  useQuery: () => convex.model,
  useConvex: () => convex.client,
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

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const ok = (email: string): BillingEmailActionResult => ({
  status: "ok",
  email,
});

let container: HTMLDivElement;
let root: Root;

const render = async (permissions?: BillingPermissions) => {
  await act(async () => {
    root.render(
      <CreemConvexProvider api={billingApi} permissions={permissions}>
        <BillingEmail />
      </CreemConvexProvider>,
    );
  });
};

const input = () => container.querySelector("input");
const button = () => container.querySelector("button");

const type = async (value: string) => {
  const element = input();
  if (!element) throw new Error("input not rendered");
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const submit = async () => {
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  convex.model = undefined;
  convex.action.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("<BillingEmail> (React)", () => {
  it("renders nothing before the entity has a Creem customer", async () => {
    convex.model = modelFor("org_1", false);
    await render();

    expect(container.innerHTML).toBe("");
    expect(convex.action).not.toHaveBeenCalled();
  });

  it("renders nothing when canManageBillingEmail is false", async () => {
    convex.model = modelFor("org_1");
    await render({ canManageBillingEmail: false });

    expect(container.innerHTML).toBe("");
    expect(convex.action).not.toHaveBeenCalled();
  });

  it("loads the email, enables save only for a valid change, and saves it", async () => {
    convex.model = modelFor("org_1");
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
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Billing email updated.",
    );
    expect(button()?.disabled).toBe(true);
  });

  it("shows the save error and keeps the form editable", async () => {
    convex.model = modelFor("org_1");
    convex.action.mockImplementation(async (ref: string) => {
      if (ref === "customersBillingEmail") return ok("billing@example.com");
      throw new Error("Conflict");
    });
    await render();

    await type("taken@example.com");
    await submit();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not update the billing email",
    );
    expect(input()?.disabled).toBe(false);
    expect(button()?.disabled).toBe(false);
  });

  it("reloads instead of saving when the server resolves another entity", async () => {
    convex.model = modelFor("org_1");
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
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("retries a failed load from the error state", async () => {
    convex.model = modelFor("org_1");
    convex.action
      .mockRejectedValueOnce(new Error("Creem unavailable"))
      .mockResolvedValueOnce(ok("billing@example.com"));
    await render();

    expect(container.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      "Could not load the billing email",
    );
    const retry = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "Try again",
    );
    expect(retry).toBeDefined();

    await act(async () => retry?.click());

    expect(input()?.value).toBe("billing@example.com");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("switches to the new entity's email and ignores the old late response", async () => {
    const org1 = deferred<BillingEmailActionResult>();
    convex.action
      .mockReturnValueOnce(org1.promise)
      .mockResolvedValueOnce(ok("org2@example.com"));

    convex.model = modelFor("org_1");
    await render();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Loading billing email...",
    );

    convex.model = modelFor("org_2");
    await render();
    await act(async () => org1.resolve(ok("org1@example.com")));

    expect(convex.action).toHaveBeenCalledTimes(2);
    expect(input()?.value).toBe("org2@example.com");
  });
});
