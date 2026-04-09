import * as readline from 'readline';
import type { TuiModuleDescriptor, TuiState } from './types';
import { createInitialState } from './types';
import { VimKeymap, KeyAction } from './keymap';
import { render, getVisibleRows, wrapDetailLines } from './renderer';
import { parseCommand } from './command-bar';

const PAGE_SIZE = 15;
const STATUS_CLEAR_MS = 3000;

export async function launchInteractiveMode<T>(descriptor: TuiModuleDescriptor<T>): Promise<void> {
  // Non-TTY fallback
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error('Interactive mode requires a TTY. Use the "list" subcommand instead.');
    process.exit(1);
  }

  const state: TuiState<T> = createInitialState<T>();
  const keymap = new VimKeymap();
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  let running = true;
  let isHandling = false;

  // Terminal setup
  const enterAltScreen = (): void => {
    process.stdout.write('\x1b[?1049h'); // Alternate screen buffer
    process.stdout.write('\x1b[?25l');   // Hide cursor
  };

  const exitAltScreen = (): void => {
    process.stdout.write('\x1b[?25h');   // Show cursor
    process.stdout.write('\x1b[?1049l'); // Exit alternate screen buffer
  };

  const cleanup = (): void => {
    if (!running) return;
    running = false;
    keymap.destroy();
    if (statusTimer) clearTimeout(statusTimer);
    if (process.stdin.isRaw) process.stdin.setRawMode(false);
    process.stdin.removeAllListeners('keypress');
    process.stdout.removeAllListeners('resize');
    exitAltScreen();
    process.stdin.pause();
  };

  const setStatus = (message: string, type: 'info' | 'success' | 'error'): void => {
    state.statusMessage = message;
    state.statusType = type;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      state.statusMessage = null;
      if (running) render(descriptor, state);
    }, STATUS_CLEAR_MS);
  };

  const doRender = (): void => {
    if (running) render(descriptor, state);
  };

  const fetchPage = async (page: number): Promise<void> => {
    state.isLoading = true;
    doRender();
    try {
      const result = await descriptor.fetchPage(page, PAGE_SIZE);
      state.items = page === 1 ? result.items : [...state.items, ...result.items];
      state.hasMorePages = result.hasMore;
      state.currentPage = page;
      if (result.total !== undefined) state.totalItems = result.total;
      applySearchFilter();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to fetch data', 'error');
    } finally {
      state.isLoading = false;
      doRender();
    }
  };

  const applySearchFilter = (): void => {
    if (!state.searchQuery || !descriptor.searchFilter) {
      state.filteredItems = state.items;
    } else {
      state.filteredItems = state.items.filter((item) =>
        descriptor.searchFilter!(item, state.searchQuery)
      );
    }
  };

  const getActiveItems = (): T[] => {
    return state.searchQuery ? state.filteredItems : state.items;
  };

  const clampCursor = (): void => {
    const items = getActiveItems();
    if (items.length === 0) {
      state.cursorIndex = 0;
      state.scrollOffset = 0;
      return;
    }
    state.cursorIndex = Math.max(0, Math.min(state.cursorIndex, items.length - 1));
    const visibleRows = getVisibleRows();
    if (state.cursorIndex < state.scrollOffset) {
      state.scrollOffset = state.cursorIndex;
    } else if (state.cursorIndex >= state.scrollOffset + visibleRows) {
      state.scrollOffset = state.cursorIndex - visibleRows + 1;
    }
  };

  const clampDetailScroll = (rawDetailLines: string[]): void => {
    const cols = process.stdout.columns || 80;
    const detailVisibleRows = Math.max(1, (process.stdout.rows || 24) - 3); // 2 header + 1 footer
    // Wrap lines the same way the renderer does to get accurate line count
    const wrappedLines = wrapDetailLines(rawDetailLines, cols - 2);
    const maxScroll = Math.max(0, wrappedLines.length - detailVisibleRows);
    state.detailScrollOffset = Math.max(0, Math.min(state.detailScrollOffset, maxScroll));
  };

  const maybeFetchMore = async (): Promise<void> => {
    const items = getActiveItems();
    if (
      state.hasMorePages &&
      !state.isLoading &&
      state.cursorIndex >= items.length - 5
    ) {
      await fetchPage(state.currentPage + 1);
    }
  };

  const handleAction = async (action: KeyAction): Promise<void> => {
    if (action === 'none') return;
    if (isHandling) return;
    isHandling = true;

    try {
      const items = getActiveItems();
      const visibleRows = getVisibleRows();

      switch (action) {
        case 'move_down': {
          if (state.mode === 'detail' && state.selectedItem) {
            const lines = descriptor.renderDetail(state.selectedItem);
            state.detailScrollOffset++;
            clampDetailScroll(lines);
          } else {
            state.cursorIndex++;
            clampCursor();
            await maybeFetchMore();
          }
          break;
        }

        case 'move_up': {
          if (state.mode === 'detail') {
            state.detailScrollOffset--;
            if (state.detailScrollOffset < 0) state.detailScrollOffset = 0;
          } else {
            state.cursorIndex--;
            clampCursor();
          }
          break;
        }

        case 'goto_top': {
          if (state.mode === 'detail') {
            state.detailScrollOffset = 0;
          } else {
            state.cursorIndex = 0;
            state.scrollOffset = 0;
          }
          break;
        }

        case 'goto_bottom': {
          if (state.mode === 'detail' && state.selectedItem) {
            const cols = process.stdout.columns || 80;
            const rawLines = descriptor.renderDetail(state.selectedItem);
            const wrappedLines = wrapDetailLines(rawLines, cols - 2);
            const detailVisibleRows = Math.max(1, (process.stdout.rows || 24) - 3);
            state.detailScrollOffset = Math.max(0, wrappedLines.length - detailVisibleRows);
          } else {
            state.cursorIndex = items.length - 1;
            clampCursor();
            await maybeFetchMore();
          }
          break;
        }

        case 'half_page_down': {
          const half = Math.floor(visibleRows / 2);
          if (state.mode === 'detail' && state.selectedItem) {
            const lines = descriptor.renderDetail(state.selectedItem);
            state.detailScrollOffset += half;
            clampDetailScroll(lines);
          } else {
            state.cursorIndex += half;
            clampCursor();
            await maybeFetchMore();
          }
          break;
        }

        case 'half_page_up': {
          const half = Math.floor(visibleRows / 2);
          if (state.mode === 'detail') {
            state.detailScrollOffset = Math.max(0, state.detailScrollOffset - half);
          } else {
            state.cursorIndex -= half;
            clampCursor();
          }
          break;
        }

        case 'select': {
          if (items.length > 0 && state.cursorIndex < items.length) {
            state.selectedItem = items[state.cursorIndex];
            state.detailScrollOffset = 0;
            state.mode = 'detail';
          }
          break;
        }

        case 'back': {
          if (state.mode === 'detail') {
            state.mode = 'list';
            state.selectedItem = null;
          }
          break;
        }

        case 'quit': {
          cleanup();
          return;
        }

        case 'enter_command': {
          state.mode = 'command';
          state.commandInput = '';
          // Show cursor for input
          process.stdout.write('\x1b[?25h');
          break;
        }

        case 'enter_search': {
          state.mode = 'search';
          state.searchQuery = '';
          applySearchFilter();
          // Show cursor for input
          process.stdout.write('\x1b[?25h');
          break;
        }

        case 'cancel_input': {
          if (state.mode === 'command') {
            state.mode = state.selectedItem ? 'detail' : 'list';
            state.commandInput = '';
          } else if (state.mode === 'search') {
            state.searchQuery = '';
            applySearchFilter();
            state.cursorIndex = 0;
            state.scrollOffset = 0;
            state.mode = 'list';
          } else if (state.mode === 'list' && state.searchQuery) {
            // Escape in list mode clears active search
            state.searchQuery = '';
            applySearchFilter();
            state.cursorIndex = 0;
            state.scrollOffset = 0;
          }
          process.stdout.write('\x1b[?25l');
          break;
        }

        case 'confirm_input': {
          if (state.mode === 'search') {
            // Accept current search and return to list
            state.mode = 'list';
            clampCursor();
            process.stdout.write('\x1b[?25l');
          } else if (state.mode === 'command') {
            process.stdout.write('\x1b[?25l');
            await executeCommand();
          }
          break;
        }

        case 'backspace_input': {
          if (state.mode === 'command') {
            state.commandInput = state.commandInput.slice(0, -1);
          } else if (state.mode === 'search') {
            state.searchQuery = state.searchQuery.slice(0, -1);
            applySearchFilter();
            state.cursorIndex = 0;
            state.scrollOffset = 0;
          }
          break;
        }

        case 'confirm_yes': {
          if (state.mode === 'confirm' && state.pendingCommand) {
            const cmd = state.pendingCommand;
            const item = state.selectedItem || (items.length > 0 ? items[state.cursorIndex] : null);
            state.pendingCommand = null;
            state.mode = state.selectedItem ? 'detail' : 'list';
            await runCommand(cmd, item);
          }
          break;
        }

        case 'confirm_no': {
          state.pendingCommand = null;
          state.mode = state.selectedItem ? 'detail' : 'list';
          setStatus('Canceled', 'info');
          break;
        }

        default: {
          // char_input
          if (typeof action === 'object' && action.type === 'char_input') {
            if (state.mode === 'command') {
              state.commandInput += action.char;
            } else if (state.mode === 'search') {
              state.searchQuery += action.char;
              applySearchFilter();
              state.cursorIndex = 0;
              state.scrollOffset = 0;
            }
          }
          break;
        }
      }

      doRender();
    } finally {
      isHandling = false;
    }
  };

  const executeCommand = async (): Promise<void> => {
    const { parsed, error } = parseCommand(state.commandInput, descriptor.commands);
    state.commandInput = '';

    if (error) {
      state.mode = state.selectedItem ? 'detail' : 'list';
      setStatus(error, 'error');
      return;
    }

    if (!parsed) {
      state.mode = state.selectedItem ? 'detail' : 'list';
      return;
    }

    const items = getActiveItems();
    const selectedItem = state.selectedItem || (items.length > 0 ? items[state.cursorIndex] : null);

    if (parsed.command.requiresSelection && !selectedItem) {
      state.mode = 'list';
      setStatus('No item selected. Navigate to an item first.', 'error');
      return;
    }

    // Destructive commands require confirmation
    if (parsed.command.destructive) {
      state.pendingCommand = parsed.command;
      state.mode = 'confirm';
      doRender();
      return;
    }

    state.mode = state.selectedItem ? 'detail' : 'list';
    await runCommand(parsed.command, selectedItem);
  };

  const runCommand = async (
    command: typeof descriptor.commands[number],
    item: T | null
  ): Promise<void> => {
    setStatus(`Running ${command.name}...`, 'info');
    doRender();

    try {
      const result = await command.execute(item, '');
      if (result.success) {
        setStatus(result.message, 'success');
        if (result.refreshList) {
          state.items = [];
          state.filteredItems = [];
          state.selectedItem = null;
          state.mode = 'list';
          await fetchPage(1);
          clampCursor();
        }
      } else {
        setStatus(result.message, 'error');
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Command failed', 'error');
    }
    doRender();
  };

  // Graceful shutdown handlers
  const onSignal = (): void => {
    cleanup();
    process.exit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  // Start TUI
  enterAltScreen();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  // Resize handler
  process.stdout.on('resize', doRender);

  // Keypress handler
  keymap.setPendingExpiredHandler(doRender);

  process.stdin.on('keypress', (str: string | undefined, key: readline.Key | undefined) => {
    if (!running) return;
    const action = keymap.resolve(str, key, state.mode);
    // Handle async actions
    handleAction(action).catch((err) => {
      setStatus(err instanceof Error ? err.message : 'Error', 'error');
      doRender();
    });
  });

  // Fetch initial data
  await fetchPage(1);
  clampCursor();
  doRender();

  // Keep the process alive until cleanup is called
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (!running) {
        clearInterval(checkInterval);
        process.removeListener('SIGINT', onSignal);
        process.removeListener('SIGTERM', onSignal);
        resolve();
      }
    }, 100);
  });
}
