import type { TuiCommandDef } from './types';

export interface ParsedCommand<T> {
  command: TuiCommandDef<T>;
  args: string;
}

export function parseCommand<T>(
  input: string,
  commands: TuiCommandDef<T>[]
): { parsed: ParsedCommand<T> | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { parsed: null, error: null };
  }

  const spaceIdx = trimmed.indexOf(' ');
  const name = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  // First try exact match
  const exactMatch = commands.find((cmd) => cmd.name === name);
  if (exactMatch) {
    return { parsed: { command: exactMatch, args }, error: null };
  }

  // Then try prefix match, but detect ambiguity
  const prefixMatches = commands.filter((cmd) => cmd.name.startsWith(name));

  if (prefixMatches.length === 0) {
    const available = commands.map((c) => c.name).join(', ');
    return {
      parsed: null,
      error: `Unknown command: ${name}. Available: ${available}`,
    };
  }

  if (prefixMatches.length > 1) {
    const ambiguous = prefixMatches.map((c) => c.name).join(', ');
    return {
      parsed: null,
      error: `Ambiguous command: ${name}. Did you mean: ${ambiguous}?`,
    };
  }

  return { parsed: { command: prefixMatches[0], args }, error: null };
}
