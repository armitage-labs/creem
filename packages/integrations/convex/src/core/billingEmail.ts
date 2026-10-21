import { getConvexErrorMessage } from "./convexError.js";
import type { BillingLabels } from "./i18n.js";
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
  /**
   * `true` once the input lost focus or a save was attempted. Validation
   * messages wait for it, so typing the first characters shows none.
   */
  touched: boolean;
  /**
   * The last failure. `"shared-customer"` means the save was refused because
   * other billing entities share the Creem customer. Widgets turn the rest
   * into a message from `cause`.
   */
  error: { phase: "load" | "save" | "shared-customer"; cause: unknown } | null;
};

const initialState: BillingEmailState = {
  status: "idle",
  email: null,
  draft: "",
  saving: false,
  saved: false,
  touched: false,
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
  /** Show validation for the draft, for example when the input loses focus. */
  markTouched: () => void;
  /**
   * Save the draft. Unless {@link canSaveBillingEmail} holds it only marks the
   * draft as touched, so an invalid address explains itself.
   */
  submit: () => Promise<void>;
};

const stateFromResult = (
  result: Extract<
    BillingEmailActionResult,
    { status: "ok" } | { status: "no-customer" }
  >,
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
        if (result.status === "ok" || result.status === "no-customer") {
          setState(stateFromResult(result, false));
        } else if (result.status === "shared-customer") {
          // Reads never refuse a shared customer; treat it as a failed load.
          setState({
            ...initialState,
            status: "load-error",
            error: { phase: "load", cause: null },
          });
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
        error: state.error?.phase === "load" ? state.error : null,
      });
    },
    markTouched: () => {
      if (state.status === "ready" && !state.touched) {
        setState({ ...state, touched: true });
      }
    },
    submit: async () => {
      if (!canSaveBillingEmail(state) || entityKey === null) {
        if (state.status === "ready" && !state.touched) {
          setState({ ...state, touched: true });
        }
        return;
      }
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
        } else if (result.status === "shared-customer") {
          // Nothing was saved. Keep the draft and say why.
          setState({
            ...state,
            saving: false,
            error: { phase: "shared-customer", cause: null },
          });
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

// ── Composition support ───────────────────────────────────────────────
// Shared by the React and Svelte `BillingEmail` parts.

/** Parts the input references for its accessible name and description. */
export type BillingEmailPart = "title" | "description" | "label" | "error";

export type BillingEmailElementIds = {
  title: string;
  description: string;
  input: string;
  error: string;
};

/** Element IDs for one `BillingEmail.Root`, derived from a unique base ID. */
export const billingEmailElementIds = (
  baseId: string,
): BillingEmailElementIds => ({
  title: `${baseId}-title`,
  description: `${baseId}-description`,
  input: `${baseId}-input`,
  error: `${baseId}-error`,
});

/**
 * What `BillingEmail.Root` exposes to its parts and to custom layouts.
 */
export type BillingEmailContextBase = {
  readonly state: BillingEmailState;
  /** `true` until the current email has loaded. */
  readonly isLoading: boolean;
  readonly canSave: boolean;
  /**
   * The draft is not a valid address: a non-empty draft at once, an empty one
   * after the input was touched. Drives `aria-invalid`.
   */
  readonly isInvalid: boolean;
  /**
   * Localized load or save error, or the validation message for a touched,
   * malformed draft; `null` otherwise.
   */
  readonly errorMessage: string | null;
  readonly labels: BillingLabels["billingEmail"];
  /** Parts drop their default classes and keep only the `class` you pass. */
  readonly unstyled: boolean;
  readonly ids: BillingEmailElementIds;
  /** Parts currently mounted inside the root. */
  readonly parts: Readonly<Record<BillingEmailPart, boolean>>;
  setDraft: (draft: string) => void;
  markTouched: () => void;
  submit: () => void;
  reload: () => void;
};

export const noBillingEmailParts: Readonly<Record<BillingEmailPart, boolean>> =
  { title: false, description: false, label: false, error: false };

/** Values the parts derive from the controller state. */
export const deriveBillingEmailView = (
  state: BillingEmailState,
  labels: BillingLabels["billingEmail"],
) => ({
  isLoading: state.status === "idle" || state.status === "loading",
  canSave: canSaveBillingEmail(state),
  // A non-empty malformed draft is flagged while typing; an empty one only
  // once touched, together with the validation message.
  isInvalid:
    state.status === "ready" &&
    !isValidBillingEmail(state.draft) &&
    (state.touched || normalizeBillingEmail(state.draft) !== ""),
  errorMessage: state.error
    ? state.error.phase === "shared-customer"
      ? labels.sharedCustomer
      : getConvexErrorMessage(
          state.error.cause,
          state.error.phase === "load" ? labels.loadFailed : labels.saveFailed,
        )
    : state.touched &&
        state.status === "ready" &&
        !isValidBillingEmail(state.draft)
      ? labels.invalid
      : null,
});

/**
 * `aria-describedby` for the input: the description and the current error,
 * each only while its part is mounted.
 */
export const billingEmailInputDescribedBy = (
  context: Pick<BillingEmailContextBase, "ids" | "parts" | "errorMessage">,
): string | undefined => {
  const ids = [
    context.parts.description ? context.ids.description : null,
    context.parts.error && context.errorMessage ? context.ids.error : null,
  ].filter((id): id is string => id !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
};
