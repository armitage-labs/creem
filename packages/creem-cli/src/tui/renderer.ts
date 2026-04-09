import chalk from 'chalk';
import type { TuiModuleDescriptor, TuiState } from './types';
import { getCachedEnv, resetEnvCache } from '../lib/env-cache';

// Regex matching all ANSI escape sequences (colors, cursor, etc.)
const ANSI_RE = /\x1b\[[0-9;]*m/g;

// Re-export for any existing consumers
export { resetEnvCache };

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}

function displayWidth(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Truncate a string that may contain ANSI codes to a given display width.
 * Preserves escape sequences and appends ellipsis when truncated.
 */
function truncateAnsi(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  const stripped = stripAnsi(str);
  if (stripped.length <= maxWidth) return str;

  // Walk the original string, tracking visible character count
  let visible = 0;
  let result = '';
  const ellipsis = maxWidth > 1 ? '\u2026' : '';
  const limit = maxWidth - (ellipsis ? 1 : 0);
  let i = 0;

  while (i < str.length && visible < limit) {
    // Check if current position starts an ANSI escape
    if (str[i] === '\x1b' && str[i + 1] === '[') {
      const end = str.indexOf('m', i);
      if (end !== -1) {
        result += str.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    result += str[i];
    visible++;
    i++;
  }

  // Close any open ANSI sequences with a reset
  result += ellipsis + '\x1b[0m';
  return result;
}

const HEADER_LINES = 3; // title + columns + separator
const FOOTER_LINES = 1; // bottom bar

const brandColor = chalk.hex('#ffbe98');
const BRAND_TEXT = 'ＣＲＥＥＭ'; // fullwidth Unicode for robotic feel
const BRAND_TEXT_WIDTH = 10; // each fullwidth char is 2 cells wide

export function getVisibleRows(): number {
  return Math.max(1, (process.stdout.rows || 24) - HEADER_LINES - FOOTER_LINES);
}

export function render<T>(descriptor: TuiModuleDescriptor<T>, state: TuiState<T>): void {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  let buffer = '';

  // Move cursor to top-left and clear screen
  buffer += '\x1b[H\x1b[2J';

  if (state.mode === 'detail' && state.selectedItem) {
    buffer += renderDetailView(descriptor, state, cols, rows);
  } else {
    buffer += renderListView(descriptor, state, cols, rows);
  }

  process.stdout.write(buffer);
}

function renderListView<T>(
  descriptor: TuiModuleDescriptor<T>,
  state: TuiState<T>,
  cols: number,
  rows: number
): string {
  let buffer = '';
  const visibleRows = Math.max(1, rows - HEADER_LINES - FOOTER_LINES);
  const items = state.searchQuery ? state.filteredItems : state.items;

  // Header line
  const env = getCachedEnv();
  const itemCount = state.totalItems !== null ? state.totalItems : items.length;
  const countSuffix = state.hasMorePages ? '+' : '';
  let title = `${chalk.bold(descriptor.name)} ${chalk.dim(`(${env})`)} ${chalk.dim(`- ${itemCount}${countSuffix} items`)}`;
  if (state.isLoading) {
    title += chalk.yellow(' loading...');
  }
  if (state.searchQuery) {
    title += chalk.cyan(` [/${state.searchQuery}]`);
  }
  buffer += truncateAnsi(` ${title}`, cols) + '\n';

  // Column headers - compute widths that fit the terminal
  const columnWidths = computeColumnWidths(descriptor.columns, cols);
  let headerLine = ' ';
  for (let i = 0; i < descriptor.columns.length; i++) {
    const col = descriptor.columns[i];
    headerLine += chalk.cyan(padCell(col.header, columnWidths[i], col.align || 'left'));
    if (i < descriptor.columns.length - 1) headerLine += '  ';
  }
  buffer += truncateAnsi(headerLine, cols) + '\n';

  // Separator - use terminal width, not headerLine length (which includes ANSI)
  buffer += chalk.dim(' ' + '\u2500'.repeat(Math.max(0, cols - 2))) + '\n';

  // Rows
  if (items.length === 0) {
    const emptyMsg = state.searchQuery
      ? 'No matching items'
      : state.isLoading
        ? 'Loading...'
        : 'No items found';
    const padTop = Math.floor(visibleRows / 2);
    for (let i = 0; i < padTop; i++) buffer += '\n';
    buffer += chalk.dim(`  ${emptyMsg}`) + '\n';
    for (let i = padTop + 1; i < visibleRows; i++) buffer += '\n';
  } else {
    for (let i = 0; i < visibleRows; i++) {
      const itemIndex = state.scrollOffset + i;
      if (itemIndex >= items.length) {
        buffer += '\n';
        continue;
      }

      const item = items[itemIndex];
      const isSelected = itemIndex === state.cursorIndex;

      let rowStr = ' ';
      for (let c = 0; c < descriptor.columns.length; c++) {
        const col = descriptor.columns[c];
        const raw = col.value(item);
        const cellVal = padCell(raw, columnWidths[c], col.align || 'left');
        rowStr += cellVal;
        if (c < descriptor.columns.length - 1) rowStr += '  ';
      }

      // Truncate to terminal width to prevent wrapping
      const truncatedRow = truncateAnsi(rowStr, cols);
      if (isSelected) {
        // Pad to full width for inverse highlight
        const rowWidth = displayWidth(truncatedRow);
        const padRight = Math.max(0, cols - rowWidth);
        buffer += chalk.inverse(truncatedRow + ' '.repeat(padRight)) + '\n';
      } else {
        buffer += truncatedRow + '\n';
      }
    }
  }

  // Bottom bar
  buffer += renderBottomBar(descriptor, state, cols);

  return buffer;
}

function renderDetailView<T>(
  descriptor: TuiModuleDescriptor<T>,
  state: TuiState<T>,
  cols: number,
  rows: number
): string {
  let buffer = '';
  const visibleRows = Math.max(1, rows - 2 - FOOTER_LINES); // title + separator + footer

  // Render detail lines, then word-wrap them to fit the terminal
  const rawLines = descriptor.renderDetail(state.selectedItem!);
  const detailLines = wrapDetailLines(rawLines, cols - 2); // -2 for leading space + margin

  // Header
  buffer += truncateAnsi(` ${chalk.bold(descriptor.name + ' Details')}`, cols) + '\n';
  buffer += chalk.dim(' ' + '\u2500'.repeat(Math.max(0, cols - 2))) + '\n';

  // Detail content with scroll
  const maxScroll = Math.max(0, detailLines.length - visibleRows);
  const scrollOff = Math.min(state.detailScrollOffset, maxScroll);

  for (let i = 0; i < visibleRows; i++) {
    const lineIdx = scrollOff + i;
    if (lineIdx < detailLines.length) {
      buffer += ' ' + truncateAnsi(detailLines[lineIdx], cols - 2) + '\n';
    } else {
      buffer += '\n';
    }
  }

  // Bottom bar
  buffer += renderBottomBar(descriptor, state, cols);

  return buffer;
}

/**
 * Word-wraps detail lines to fit within maxWidth.
 * Handles lines with ANSI codes by stripping for measurement.
 * Long values in key-value lines wrap with indentation to align under the value.
 */
export function wrapDetailLines(lines: string[], maxWidth: number): string[] {
  if (maxWidth <= 0) return lines;
  const wrapped: string[] = [];

  for (const line of lines) {
    const visLen = displayWidth(line);
    if (visLen <= maxWidth) {
      wrapped.push(line);
      continue;
    }

    // For empty/short lines, just truncate
    if (maxWidth < 10) {
      wrapped.push(truncateAnsi(line, maxWidth));
      continue;
    }

    // Try to detect key-value format: "Key            Value..."
    // Look for double-space separator between label and value
    const plain = stripAnsi(line);
    const kvMatch = plain.match(/^(\S[^]*?\S)\s{2,}(.+)$/);

    if (kvMatch) {
      // Key-value line: wrap the value portion, indent continuation lines
      const labelEnd = plain.indexOf(kvMatch[2]!);

      if (labelEnd >= maxWidth) {
        // Label itself fills the line — treat as plain text wrap
        let remaining = stripAnsi(line);
        while (remaining.length > maxWidth) {
          wrapped.push(remaining.slice(0, maxWidth));
          remaining = remaining.slice(maxWidth);
        }
        if (remaining.length > 0) wrapped.push(remaining);
      } else {
        const indentWidth = Math.min(labelEnd, Math.floor(maxWidth * 0.4));

        // First line: preserve ANSI colors (truncateAnsi keeps escape sequences intact)
        wrapped.push(truncateAnsi(line, maxWidth));

        // Wrap remaining value text with indentation (plain text for continuations is fine)
        const valueText = kvMatch[2]!;
        const firstValueWidth = maxWidth - labelEnd;
        if (firstValueWidth < valueText.length && firstValueWidth > 1) {
          // Account for ellipsis taking one character position on truncated first line
          // (need at least 2 chars of space to show 1 char + ellipsis)
          const firstLineValueChars = Math.max(0, firstValueWidth - 1);
          let remaining = valueText.slice(firstLineValueChars);
          const wrapWidth = Math.max(1, maxWidth - indentWidth);
          while (remaining.length > 0) {
            const chunk = remaining.slice(0, wrapWidth);
            wrapped.push(' '.repeat(indentWidth) + chunk);
            remaining = remaining.slice(wrapWidth);
          }
        }
      }
    } else {
      // Plain text line: first chunk preserves ANSI colors, rest is plain
      let remaining = stripAnsi(line);
      let isFirst = true;
      while (remaining.length > maxWidth) {
        if (isFirst) {
          wrapped.push(truncateAnsi(line, maxWidth));
          isFirst = false;
          // Account for ellipsis taking one character position in truncateAnsi
          remaining = remaining.slice(maxWidth - 1);
        } else {
          // Continuation lines also need ellipsis when more content follows
          wrapped.push(remaining.slice(0, maxWidth - 1) + '\u2026');
          remaining = remaining.slice(maxWidth - 1);
        }
      }
      if (remaining.length > 0) {
        if (isFirst) {
          wrapped.push(line); // Short enough after strip — keep original with ANSI
        } else {
          wrapped.push(remaining);
        }
      }
    }
  }

  return wrapped;
}

function buildBar(controls: string, cols: number): string {
  const brand = ' ' + brandColor.bold(BRAND_TEXT) + '  ';
  const brandWidth = BRAND_TEXT_WIDTH + 3; // space + text + 2 spaces
  const controlsWidth = displayWidth(controls);
  // Show brand on the left if there's room
  if (cols >= brandWidth + controlsWidth) {
    const padRight = Math.max(0, cols - brandWidth - controlsWidth);
    return chalk.inverse(brand + controls + ' '.repeat(padRight));
  }
  const padRight = Math.max(0, cols - controlsWidth);
  return chalk.inverse(controls + ' '.repeat(padRight));
}

function renderBottomBar<T>(
  descriptor: TuiModuleDescriptor<T>,
  state: TuiState<T>,
  cols: number
): string {
  // Status message takes priority if present
  if (state.statusMessage) {
    const colorFn =
      state.statusType === 'error' ? chalk.red :
      state.statusType === 'success' ? chalk.green : chalk.blue;
    const msg = truncateAnsi(` ${state.statusMessage}`, cols);
    const padRight = Math.max(0, cols - displayWidth(msg));
    return colorFn(msg + ' '.repeat(padRight));
  }

  if (state.mode === 'command') {
    const msg = ` :${state.commandInput}`;
    return chalk.inverse(msg.padEnd(cols));
  }

  if (state.mode === 'search') {
    const msg = ` /${state.searchQuery}`;
    return chalk.inverse(msg.padEnd(cols));
  }

  if (state.mode === 'confirm' && state.pendingCommand) {
    const msg = ` ${state.pendingCommand.name} selected item? (y/n)`;
    return chalk.yellow.inverse(msg.padEnd(cols));
  }

  if (state.mode === 'detail') {
    const cmdParts: string[] = [chalk.dim('q') + ':back'];
    for (const cmd of descriptor.commands) {
      cmdParts.push(chalk.dim(':' + cmd.name));
    }
    const bar = ' ' + cmdParts.join('  ');
    return buildBar(bar, cols);
  }

  // List mode - adapt help hints to available width
  let parts: string[];
  if (cols < 50) {
    parts = [
      chalk.dim('j/k') + ':nav',
      chalk.dim('q') + ':quit',
    ];
  } else if (cols < 70) {
    parts = [
      chalk.dim('j/k') + ':nav',
      chalk.dim('Enter') + ':open',
      chalk.dim('/') + ':search',
      chalk.dim('q') + ':quit',
    ];
  } else {
    parts = [
      chalk.dim('j/k') + ':nav',
      chalk.dim('Enter') + ':details',
      chalk.dim('/') + ':search',
      chalk.dim(':') + ':command',
      chalk.dim('q') + ':quit',
    ];
  }
  const bar = ' ' + parts.join('  ');
  return buildBar(bar, cols);
}

function computeColumnWidths(columns: { width: number | 'auto'; header: string }[], totalCols: number): number[] {
  const gap = 2;
  const gapSpace = (columns.length - 1) * gap + 1; // +1 for leading space
  const autoCount = columns.filter((c) => c.width === 'auto').length;

  // Calculate the total fixed width requested
  const requestedFixed = columns.reduce((sum, col) => {
    return sum + (typeof col.width === 'number' ? col.width : 0);
  }, 0);

  const availableForContent = totalCols - gapSpace;

  // If fixed columns alone exceed available space, shrink them proportionally
  if (requestedFixed > availableForContent && requestedFixed > 0) {
    const scale = Math.max(0.2, availableForContent / requestedFixed);
    return columns.map((col) => {
      if (typeof col.width === 'number') {
        return Math.max(col.header.length, Math.floor(col.width * scale));
      }
      // Auto columns get minimum header width when space is tight
      return col.header.length;
    });
  }

  const remaining = Math.max(0, availableForContent - requestedFixed);
  const autoWidth = autoCount > 0 ? Math.floor(remaining / autoCount) : 0;

  return columns.map((col) => {
    if (typeof col.width === 'number') return col.width;
    return Math.max(col.header.length, autoWidth);
  });
}

function padCell(text: string, width: number, align: 'left' | 'right' | 'center'): string {
  const visLen = displayWidth(text);

  // Need to truncate — use truncateAnsi to preserve ANSI color codes
  if (visLen > width) {
    return truncateAnsi(text, width);
  }

  // Pad to desired width
  const pad = Math.max(0, width - visLen);
  if (align === 'right') return ' '.repeat(pad) + text;
  if (align === 'center') {
    const left = Math.floor(pad / 2);
    return ' '.repeat(left) + text + ' '.repeat(pad - left);
  }
  return text + ' '.repeat(pad);
}
