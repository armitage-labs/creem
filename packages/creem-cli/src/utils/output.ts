import Table from 'cli-table3';
import chalk from 'chalk';

export interface OutputOptions {
  json?: boolean;
}

/**
 * Outputs data as JSON
 */
export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Strips ANSI escape codes to measure visible string length
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Outputs data as a formatted table, adapting to terminal width.
 * Falls back to a compact card layout when columns won't fit.
 */
export function outputTable(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const termWidth = process.stdout.columns || 80;
  const colCount = headers.length;

  // cli-table3 uses 3 chars per border/padding (│ + space padding) plus 1 for the trailing │
  const borderOverhead = colCount + 1;

  // Measure the max visible width needed per column (from headers + data)
  const maxColWidths = headers.map((h) => stripAnsi(h).length);
  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cell = row[i];
      const len = stripAnsi(cell === null || cell === undefined ? '-' : String(cell)).length;
      if (len > maxColWidths[i]) {
        maxColWidths[i] = len;
      }
    }
  }

  // Each column needs at least its content width + 2 chars padding (cli-table3 default)
  const naturalWidth = maxColWidths.reduce((sum, w) => sum + w + 2, 0) + borderOverhead;

  // If the table fits, render normally
  if (naturalWidth <= termWidth) {
    const table = new Table({
      head: headers.map((h) => chalk.cyan(h)),
      style: { head: [], border: [] },
    });
    rows.forEach((row) => {
      table.push(row.map((cell) => (cell === null || cell === undefined ? '-' : String(cell))));
    });
    console.log(table.toString());
    return;
  }

  // Try to fit by truncating columns proportionally
  const availableContent = termWidth - borderOverhead - colCount * 2; // subtract padding
  if (availableContent >= colCount * 4) {
    // Enough room for at least 4 chars per column — use truncated table
    const colWidths = fitColumns(maxColWidths, availableContent);
    const table = new Table({
      head: headers.map((h, i) => chalk.cyan(truncate(h, colWidths[i]))),
      style: { head: [], border: [] },
      colWidths: colWidths.map((w) => w + 2), // add padding
    });
    rows.forEach((row) => {
      table.push(
        row.map((cell, i) => {
          const val = cell === null || cell === undefined ? '-' : String(cell);
          return truncate(stripAnsi(val), colWidths[i]);
        })
      );
    });
    console.log(table.toString());
    return;
  }

  // Terminal is very narrow — fall back to card layout
  for (let r = 0; r < rows.length; r++) {
    if (r > 0) console.log(chalk.dim('─'.repeat(Math.min(termWidth - 1, 40))));
    for (let c = 0; c < colCount; c++) {
      const cell = rows[r][c];
      const val = cell === null || cell === undefined ? '-' : String(cell);
      console.log(`${chalk.cyan(headers[c])}: ${val}`);
    }
  }
}

/**
 * Distributes available width across columns, shrinking the widest first.
 */
function fitColumns(naturalWidths: number[], available: number): number[] {
  const widths = [...naturalWidths];
  let total = widths.reduce((s, w) => s + w, 0);

  while (total > available) {
    const maxWidth = Math.max(...widths);
    // Find all columns at the maximum width
    const maxIndices = widths
      .map((w, i) => (w === maxWidth ? i : -1))
      .filter((i) => i !== -1);

    // When multiple columns are tied at max width, shrink them all by 1
    if (maxIndices.length > 1) {
      for (const idx of maxIndices) {
        if (widths[idx] > 4 && total > available) {
          widths[idx]--;
          total--;
        }
      }
      // If we couldn't shrink any (all at minimum), break to avoid infinite loop
      if (maxIndices.every((idx) => widths[idx] <= 4)) break;
    } else {
      // Single max column: shrink to second max or as needed
      const maxIdx = maxIndices[0];
      const secondMax = Math.max(...widths.filter((_, i) => i !== maxIdx), 4);
      const target = Math.max(secondMax, 4);
      const reduction = Math.min(widths[maxIdx] - target, total - available);
      if (reduction === 0) break;
      widths[maxIdx] -= reduction;
      total -= reduction;
    }
  }

  return widths.map((w) => Math.max(w, 4));
}

/**
 * Outputs key-value pairs
 */
export function outputKeyValue(
  data: Record<string, unknown>,
  options: OutputOptions = {}
): void {
  if (options.json) {
    outputJson(data);
    return;
  }

  const maxKeyLength = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    const paddedKey = key.padEnd(maxKeyLength);
    const displayValue = value === null || value === undefined ? chalk.dim('-') : String(value);
    console.log(`${chalk.cyan(paddedKey)}  ${displayValue}`);
  }
}

/**
 * Outputs a success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Outputs an error message
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Outputs a warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

/**
 * Outputs an info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Outputs a dim/muted message
 */
export function dim(message: string): void {
  console.log(chalk.dim(message));
}

/**
 * Creates a styled header
 */
export function header(text: string): void {
  console.log();
  console.log(chalk.bold(text));
  console.log(chalk.dim('─'.repeat(text.length)));
}

/**
 * Adds a blank line
 */
export function newline(): void {
  console.log();
}

/**
 * Formats a date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100); // Assuming amounts are in cents
}

/**
 * Truncates a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Returns the label padding width for TUI detail views,
 * adapted to the current terminal width.
 */
export function detailLabelWidth(): number {
  const cols = process.stdout.columns || 80;
  if (cols < 50) return 10;
  if (cols < 70) return 14;
  return 18;
}

/**
 * Formats a key-value line for TUI detail views.
 * Label is cyan and padded to a width that adapts to the terminal.
 */
export function detailLine(label: string, value: string): string {
  const w = detailLabelWidth();
  return `${chalk.cyan(label.padEnd(w))}  ${value}`;
}
