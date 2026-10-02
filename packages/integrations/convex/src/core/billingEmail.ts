import type { BillingEmailActionResult } from "./types.js";

/**
 * Framework-neutral state for the `<BillingEmail>` widgets.
 *
 * The React and Svelte widgets only render this state and forward input to the
 * controller, so loading, saving, validation, and entity switching behave the
 * same in both frameworks.
 */

// RFC 5321 caps a forward path at 256 octets including the angle brackets.
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim the surrounding whitespace a pasted address often carries. */
export const normalizeBillingEmail = (value: string): string => value.trim();

/**
 * Loose syntax check for a billing email draft.
 *
 * It only keeps obvious typos from reaching Creem, which performs the
 * authoritative validation.
 */
export const isValidBillingEmail = (value: string): boolean => {
  const email = normalizeBillingEmail(value);
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
};

export type BillingEmailState = {
  /**
   * - `"idle"` — no billing entity to load for
   * - `"loading"` — reading the current email from Creem
   * - `"ready"` — `email` holds the current address
   * - `"no-customer"` — the entity has no Creem customer yet
   * - `"load-error"` — reading the current email failed
   */
  status: "idle" | "loading" | "ready" | "no-customer" | "load-error";
  /** The address Creem currently sends invoices and receipts to. */
  email: string | null;
  /** The input value. */
  draft: string;
  saving: boolean;
  /** `true` after a successful save, until the draft changes again. */
  saved: boolean;
  /** The last failure. Widgets turn `cause` into a message. */
  error: { phase: "load" | "save"; cause: unknown } | null;
};

const initialState: BillingEmailState = {
  status: "idle",
  email: null,
  draft: "",
  saving: false,
  saved: false,
  error: null,
};

/**
 * Whether the draft can be saved: the current email is known, no save is
 * running, and the draft is a valid address that differs from the current one.
 *
 * Creem stores addresses lowercased, so a change in case alone is not a change.
 */
export const canSaveBillingEmail = (state: BillingEmailState): boolean =>
  state.status === "ready" &&
  state.email !== null &&
  !state.saving &&
  isValidBillingEmail(state.draft) &&
  normalizeBillingEmail(state.draft).toLowerCase() !==
    state.email.toLowerCase();

export type BillingEmailControllerOptions = {
  /**
   * Read the billing email of `entityKey`, the entity the form displays.
   * Answer `"entity-changed"` when the server resolves a different entity.
   */
  load: (entityKey: string) => Promise<BillingEmailActionResult>;
  /** Change the billing email of `entityKey`, with the same guard. */
  save: (entityKey: string, email: string) => Promise<BillingEmailActionResult>;
};

export type BillingEmailController = {
  getState: () => BillingEmailState;
  /** Register a change listener. Returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /**
   * Point the controller at a billing entity. A new key discards the previous
   * entity's state and in-flight responses and loads the new entity's email;
   * `null` clears the state without loading.
   */
  setEntity: (entityKey: string | null) => void;
  /** Load the current entity's email again, for example after a failed load. */
  reload: () => void;
  setDraft: (draft: string) => void;
  /** Save the draft. Does nothing unless {@link canSaveBillingEmail} holds. */
  submit: () => Promise<void>;
};

const stateFromResult = (
  result: Exclude<BillingEmailActionResult, { status: "entity-changed" }>,
  saved: boolean,
): BillingEmailState =>
  result.status === "ok"
    ? {
        ...initialState,
        status: "ready",
        email: result.email,
        draft: result.email,
        saved,
      }
    : { ...initialState, status: "no-customer" };

const entityChangedError = new Error(
  "The billing entity changed while loading its email.",
);

export const createBillingEmailController = ({
  load,
  save,
}: BillingEmailControllerOptions): BillingEmailController => {
  let state = initialState;
  let entityKey: string | null = null;
  // Incremented whenever the form starts over (entity change or reload). A
  // response whose generation is no longer current belongs to an earlier
  // form and is dropped, so a slow read for one organization can never
  // overwrite the form of the next.
  let generation = 0;
  const listeners = new Set<() => void>();

  const setState = (next: BillingEmailState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  // `"entity-changed"` means the server already resolves another entity and
  // the new key is usually about to arrive through `setEntity`. Reload once in
  // case the server moved back; a second mismatch becomes a retryable error
  // instead of a load loop.
  const startLoad = (afterEntityChange: boolean) => {
    const key = entityKey;
    const current = ++generation;
    if (key === null) {
      setState(initialState);
      return;
    }
    setState({ ...initialState, status: "loading" });
    load(key).then(
      (result) => {
        if (current !== generation) return;
        if (result.status !== "entity-changed") {
          setState(stateFromResult(result, false));
        } else if (!afterEntityChange) {
          startLoad(true);
        } else {
          setState({
            ...initialState,
            status: "load-error",
            error: { phase: "load", cause: entityChangedError },
          });
        }
      },
      (cause: unknown) => {
        if (current === generation) {
          setState({
            ...initialState,
            status: "load-error",
            error: { phase: "load", cause },
          });
        }
      },
    );
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEntity: (nextEntityKey) => {
      if (nextEntityKey === entityKey) return;
      entityKey = nextEntityKey;
      startLoad(false);
    },
    reload: () => {
      if (entityKey !== null) startLoad(false);
    },
    setDraft: (draft) => {
      setState({
        ...state,
        draft,
        saved: false,
        error: state.error?.phase === "save" ? null : state.error,
      });
    },
    submit: async () => {
      if (!canSaveBillingEmail(state) || entityKey === null) return;
      const current = generation;
      const email = normalizeBillingEmail(state.draft);
      setState({ ...state, saving: true, saved: false, error: null });
      try {
        const result = await save(entityKey, email);
        if (current !== generation) return;
        if (result.status === "entity-changed") {
          // Nothing was saved. The draft belongs to an entity the server no
          // longer resolves, so start over instead of offering to retry it.
          startLoad(false);
        } else {
          setState(stateFromResult(result, true));
        }
      } catch (cause) {
        if (current === generation) {
          setState({
            ...state,
            saving: false,
            error: { phase: "save", cause },
          });
        }
      }
    },
  };
};
