import type { TuiMode } from "./types";

export type KeyAction =
  | "move_up"
  | "move_down"
  | "goto_top"
  | "goto_bottom"
  | "half_page_up"
  | "half_page_down"
  | "select"
  | "back"
  | "quit"
  | "enter_command"
  | "enter_search"
  | "confirm_input"
  | "backspace_input"
  | "cancel_input"
  | "confirm_yes"
  | "confirm_no"
  | { type: "char_input"; char: string }
  | "none";

interface KeypressKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

const PENDING_TIMEOUT_MS = 300;

export class VimKeymap {
  private pendingKey: string | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private onPendingExpired: (() => void) | null = null;

  setPendingExpiredHandler(handler: () => void): void {
    this.onPendingExpired = handler;
  }

  resolve(
    str: string | undefined,
    key: KeypressKey | undefined,
    mode: TuiMode,
  ): KeyAction {
    if (mode === "confirm") {
      return this.resolveConfirmMode(str, key);
    }
    if (mode === "command" || mode === "search") {
      return this.resolveInputMode(str, key);
    }
    if (mode === "detail") {
      return this.resolveDetailMode(str, key);
    }
    return this.resolveListMode(str, key);
  }

  destroy(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pendingKey = null;
  }

  private resolveConfirmMode(
    str: string | undefined,
    key: KeypressKey | undefined,
  ): KeyAction {
    // Ctrl+C should quit (consistent with other modes)
    if (key?.ctrl && key?.name === "c") return "quit";
    if (str === "y" || str === "Y") return "confirm_yes";
    if (str === "n" || str === "N" || key?.name === "escape")
      return "confirm_no";
    return "none";
  }

  private resolveInputMode(
    str: string | undefined,
    key: KeypressKey | undefined,
  ): KeyAction {
    if (key?.name === "escape") return "cancel_input";
    if (key?.name === "return") return "confirm_input";
    if (key?.name === "backspace") return "backspace_input";

    // Ctrl-c should quit
    if (key?.ctrl && key?.name === "c") return "quit";

    // Printable character
    if (str && str.length === 1 && !key?.ctrl && !key?.meta) {
      return { type: "char_input", char: str };
    }

    return "none";
  }

  private resolveDetailMode(
    str: string | undefined,
    key: KeypressKey | undefined,
  ): KeyAction {
    if (key?.ctrl && key?.name === "c") return this.clearPending("quit");
    if (str === "q" || key?.name === "escape") return this.clearPending("back");
    if (str === "j" || key?.name === "down")
      return this.clearPending("move_down");
    if (str === "k" || key?.name === "up") return this.clearPending("move_up");
    if (key?.ctrl && key?.name === "d")
      return this.clearPending("half_page_down");
    if (key?.ctrl && key?.name === "u")
      return this.clearPending("half_page_up");
    if (str === ":") return this.clearPending("enter_command");

    // gg / G
    if (str === "G" && !key?.ctrl) return this.clearPending("goto_bottom");
    if (str === "g") return this.handlePendingG();

    this.clearPendingState();
    return "none";
  }

  private resolveListMode(
    str: string | undefined,
    key: KeypressKey | undefined,
  ): KeyAction {
    // Ctrl-c always quits
    if (key?.ctrl && key?.name === "c") return "quit";

    // Navigation
    if (str === "j" || key?.name === "down")
      return this.clearPending("move_down");
    if (str === "k" || key?.name === "up") return this.clearPending("move_up");
    if (key?.ctrl && key?.name === "d")
      return this.clearPending("half_page_down");
    if (key?.ctrl && key?.name === "u")
      return this.clearPending("half_page_up");

    // G goes to bottom
    if (str === "G" && !key?.ctrl) return this.clearPending("goto_bottom");

    // gg goes to top (multi-key sequence)
    if (str === "g") return this.handlePendingG();

    // Actions
    if (key?.name === "return") return this.clearPending("select");
    if (str === "q") return this.clearPending("quit");
    if (key?.name === "escape") return this.clearPending("cancel_input");
    if (str === ":") return this.clearPending("enter_command");
    if (str === "/") return this.clearPending("enter_search");

    // Any other key clears pending
    this.clearPendingState();
    return "none";
  }

  private handlePendingG(): KeyAction {
    if (this.pendingKey === "g") {
      this.clearPendingState();
      return "goto_top";
    }

    this.pendingKey = "g";
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      this.pendingKey = null;
      this.pendingTimer = null;
      if (this.onPendingExpired) this.onPendingExpired();
    }, PENDING_TIMEOUT_MS);

    return "none";
  }

  private clearPending(action: KeyAction): KeyAction {
    this.clearPendingState();
    return action;
  }

  private clearPendingState(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pendingKey = null;
  }
}
