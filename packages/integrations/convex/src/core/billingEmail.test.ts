import { describe, expect, it, vi } from "vitest";
import {
  canSaveBillingEmail,
  createBillingEmailController,
  deriveBillingEmailView,
  isValidBillingEmail,
  type BillingEmailState,
} from "./billingEmail.js";
import type { BillingEmailActionResult } from "./types.js";
import { defaultBillingLabels } from "./i18n.js";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const ok = (email: string): BillingEmailActionResult => ({
  status: "ok",
  email,
});

const ready = (
  overrides: Partial<BillingEmailState> = {},
): BillingEmailState => ({
  status: "ready",
  email: "billing@example.com",
  draft: "billing@example.com",
  saving: false,
  saved: false,
  touched: false,
  error: null,
  ...overrides,
});

describe("isValidBillingEmail", () => {
  it("accepts ordinary addresses, ignoring surrounding whitespace", () => {
    expect(isValidBillingEmail("billing@example.com")).toBe(true);
    expect(isValidBillingEmail("  accounts+invoices@example.co.uk ")).toBe(
      true,
    );
  });

  it("rejects empty, malformed, and overlong input", () => {
    expect(isValidBillingEmail("")).toBe(false);
    expect(isValidBillingEmail("billing")).toBe(false);
    expect(isValidBillingEmail("billing@example")).toBe(false);
    expect(isValidBillingEmail("bill ing@example.com")).toBe(false);
    expect(isValidBillingEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("canSaveBillingEmail", () => {
  it("allows saving a valid, changed address", () => {
    expect(canSaveBillingEmail(ready({ draft: "new@example.com" }))).toBe(true);
  });

  it("disables saving when the draft is unchanged, including case only", () => {
    expect(canSaveBillingEmail(ready())).toBe(false);
    expect(canSaveBillingEmail(ready({ draft: " Billing@Example.com " }))).toBe(
      false,
    );
  });

  it("disables saving an invalid draft", () => {
    expect(canSaveBillingEmail(ready({ draft: "new@" }))).toBe(false);
  });

  it("disables saving while loading or saving", () => {
    expect(
      canSaveBillingEmail(
        ready({ status: "loading", email: null, draft: "new@example.com" }),
      ),
    ).toBe(false);
    expect(
      canSaveBillingEmail(ready({ draft: "new@example.com", saving: true })),
    ).toBe(false);
  });
});

describe("createBillingEmailController", () => {
  it("stays idle without an entity", () => {
    const load = vi.fn();
    const controller = createBillingEmailController({ load, save: vi.fn() });

    controller.setEntity(null);

    expect(controller.getState().status).toBe("idle");
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the current email into the draft", async () => {
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save: vi.fn(),
    });

    controller.setEntity("org_1");
    expect(controller.getState().status).toBe("loading");
    await flush();

    expect(controller.getState()).toEqual(ready());
  });

  it("reports an entity without a Creem customer", async () => {
    const controller = createBillingEmailController({
      load: async () => ({ status: "no-customer" }),
      save: vi.fn(),
    });

    controller.setEntity("org_1");
    await flush();

    expect(controller.getState().status).toBe("no-customer");
  });

  it("keeps the load failure for the widget to display", async () => {
    const cause = new Error("Creem unavailable");
    const controller = createBillingEmailController({
      load: async () => {
        throw cause;
      },
      save: vi.fn(),
    });

    controller.setEntity("org_1");
    await flush();

    expect(controller.getState()).toMatchObject({
      status: "load-error",
      error: { phase: "load", cause },
    });
  });

  it("does not reload for the same entity", async () => {
    const load = vi.fn(async () => ok("billing@example.com"));
    const controller = createBillingEmailController({ load, save: vi.fn() });

    controller.setEntity("org_1");
    controller.setEntity("org_1");
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("saves a trimmed draft and marks it saved until the next edit", async () => {
    const save = vi.fn(async (_entityKey: string, email: string) =>
      ok(email.toLowerCase()),
    );
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save,
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setEntity("org_1");
    await flush();

    controller.setDraft("  Accounts@Example.com ");
    const submitted = controller.submit();
    expect(controller.getState().saving).toBe(true);
    await submitted;

    expect(save).toHaveBeenCalledWith("org_1", "Accounts@Example.com");
    expect(controller.getState()).toEqual(
      ready({
        email: "accounts@example.com",
        draft: "accounts@example.com",
        saved: true,
      }),
    );
    expect(listener).toHaveBeenCalled();

    controller.setDraft("accounts@example.co");
    expect(controller.getState().saved).toBe(false);
  });

  it("does not submit when saving is not allowed", async () => {
    const save = vi.fn();
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save,
    });
    controller.setEntity("org_1");
    await flush();

    await controller.submit();
    controller.setDraft("not-an-email");
    await controller.submit();

    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the draft editable after a failed save and clears the error on edit", async () => {
    const cause = new Error("Conflict");
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save: async () => {
        throw cause;
      },
    });
    controller.setEntity("org_1");
    await flush();

    controller.setDraft("taken@example.com");
    await controller.submit();

    expect(controller.getState()).toEqual(
      ready({ draft: "taken@example.com", error: { phase: "save", cause } }),
    );
    expect(canSaveBillingEmail(controller.getState())).toBe(true);

    controller.setDraft("free@example.com");
    expect(controller.getState().error).toBeNull();
  });

  it("hides the form when the customer disappeared before saving", async () => {
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save: async () => ({ status: "no-customer" }),
    });
    controller.setEntity("org_1");
    await flush();

    controller.setDraft("new@example.com");
    await controller.submit();

    expect(controller.getState().status).toBe("no-customer");
  });

  it("resets on entity switch and ignores the previous entity's late load", async () => {
    const first = deferred<BillingEmailActionResult>();
    const second = deferred<BillingEmailActionResult>();
    const load = vi
      .fn<(entityKey: string) => Promise<BillingEmailActionResult>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const controller = createBillingEmailController({ load, save: vi.fn() });

    controller.setEntity("org_1");
    controller.setEntity("org_2");
    expect(controller.getState().status).toBe("loading");

    second.resolve(ok("org2@example.com"));
    await flush();
    first.resolve(ok("org1@example.com"));
    await flush();

    expect(controller.getState()).toEqual(
      ready({ email: "org2@example.com", draft: "org2@example.com" }),
    );
  });

  it("drops a draft and a save response that belong to the previous entity", async () => {
    const pendingSave = deferred<BillingEmailActionResult>();
    const controller = createBillingEmailController({
      load: vi
        .fn<(entityKey: string) => Promise<BillingEmailActionResult>>()
        .mockResolvedValueOnce(ok("org1@example.com"))
        .mockResolvedValueOnce(ok("org2@example.com")),
      save: () => pendingSave.promise,
    });
    controller.setEntity("org_1");
    await flush();

    controller.setDraft("new@example.com");
    const submitted = controller.submit();
    controller.setEntity("org_2");
    await flush();
    pendingSave.resolve(ok("new@example.com"));
    await submitted;

    expect(controller.getState()).toEqual(
      ready({ email: "org2@example.com", draft: "org2@example.com" }),
    );
  });

  it("clears state when the entity goes away", async () => {
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save: vi.fn(),
    });
    controller.setEntity("org_1");
    await flush();

    controller.setEntity(null);

    expect(controller.getState()).toMatchObject({
      status: "idle",
      email: null,
      draft: "",
    });
  });

  it("asks for the displayed entity's email", async () => {
    const load = vi.fn(async () => ok("billing@example.com"));
    const controller = createBillingEmailController({ load, save: vi.fn() });

    controller.setEntity("org_1");
    await flush();

    expect(load).toHaveBeenCalledWith("org_1");
  });

  it("reloads after a transient load failure", async () => {
    const load = vi
      .fn<(entityKey: string) => Promise<BillingEmailActionResult>>()
      .mockRejectedValueOnce(new Error("Creem unavailable"))
      .mockResolvedValueOnce(ok("billing@example.com"));
    const controller = createBillingEmailController({ load, save: vi.fn() });
    controller.setEntity("org_1");
    await flush();
    expect(controller.getState().status).toBe("load-error");

    controller.reload();
    await flush();

    expect(load).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toEqual(ready());
  });

  it("starts over when the server resolves another entity at save time", async () => {
    // The resolver moved to another organization after the form loaded. The
    // save must not land there; the form reloads instead.
    const load = vi
      .fn<(entityKey: string) => Promise<BillingEmailActionResult>>()
      .mockResolvedValueOnce(ok("org1@example.com"))
      .mockResolvedValueOnce(ok("org1@example.com"));
    const save = vi.fn(
      async (): Promise<BillingEmailActionResult> => ({
        status: "entity-changed",
      }),
    );
    const controller = createBillingEmailController({ load, save });
    controller.setEntity("org_1");
    await flush();

    controller.setDraft("new@example.com");
    await controller.submit();
    await flush();

    expect(save).toHaveBeenCalledWith("org_1", "new@example.com");
    expect(load).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toEqual(
      ready({ email: "org1@example.com", draft: "org1@example.com" }),
    );
  });

  it("reloads once on an entity mismatch, then offers a retry", async () => {
    const load = vi.fn(
      async (): Promise<BillingEmailActionResult> => ({
        status: "entity-changed",
      }),
    );
    const controller = createBillingEmailController({ load, save: vi.fn() });

    controller.setEntity("org_1");
    await flush();

    expect(load).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({
      status: "load-error",
      error: { phase: "load" },
    });
  });

  it("drops a mismatch answer once the new entity arrives", async () => {
    const stale = deferred<BillingEmailActionResult>();
    const load = vi
      .fn<(entityKey: string) => Promise<BillingEmailActionResult>>()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(ok("org2@example.com"));
    const controller = createBillingEmailController({ load, save: vi.fn() });

    controller.setEntity("org_1");
    controller.setEntity("org_2");
    await flush();
    stale.resolve({ status: "entity-changed" });
    await flush();

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith("org_2");
    expect(controller.getState()).toEqual(
      ready({ email: "org2@example.com", draft: "org2@example.com" }),
    );
  });

  it("stops notifying after unsubscribe", async () => {
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save: vi.fn(),
    });
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();

    controller.setEntity("org_1");
    await flush();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("billing email validation message", () => {
  const labels = defaultBillingLabels.billingEmail;
  const message = (state: BillingEmailState) =>
    deriveBillingEmailView(state, labels).errorMessage;

  it("stays hidden while the draft is being typed", () => {
    expect(message(ready({ draft: "acc" }))).toBeNull();
  });

  it("explains a malformed or empty draft once touched", () => {
    expect(message(ready({ draft: "accounts@", touched: true }))).toBe(
      "Enter a valid email address.",
    );
    expect(message(ready({ draft: "  ", touched: true }))).toBe(
      "Enter a valid email address.",
    );
    // `aria-invalid` follows the message for an empty draft, not before.
    const invalid = (state: BillingEmailState) =>
      deriveBillingEmailView(state, labels).isInvalid;
    expect(invalid(ready({ draft: "" }))).toBe(false);
    expect(invalid(ready({ draft: "", touched: true }))).toBe(true);
    expect(invalid(ready({ draft: "accounts@" }))).toBe(true);
    expect(message(ready({ draft: "ok@example.com", touched: true }))).toBe(
      null,
    );
  });

  it("is touched by losing focus or by a save attempt, and reset by a save", async () => {
    const controller = createBillingEmailController({
      load: async () => ok("billing@example.com"),
      save: async (_entityKey, email) => ok(email),
    });
    controller.setEntity("org_1");
    await flush();

    controller.setDraft("accounts@");
    expect(controller.getState().touched).toBe(false);
    await controller.submit();
    expect(controller.getState().touched).toBe(true);

    controller.setDraft("accounts@example.com");
    await controller.submit();
    expect(controller.getState().touched).toBe(false);

    controller.setDraft("x");
    controller.markTouched();
    expect(message(controller.getState())).toBe("Enter a valid email address.");
  });
});
