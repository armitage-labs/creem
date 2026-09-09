import Table from "cli-table3";
import type { CliContext } from "../lib/context";
import { isRecord } from "../lib/operation";
import { pageItems } from "../lib/pagination";
import { redact } from "../lib/errors";

export function json(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}
function humanValue(value: unknown): string {
  return value === null || value === undefined
    ? "-"
    : typeof value === "object"
      ? json(value)
      : String(value);
}
function redactKeys(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redactKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      /^(key|licenseKey|apiKey|api_key)$/i.test(key) ? "[REDACTED]" : redactKeys(v),
    ]),
  );
}
export function writeResult(context: CliContext, value: unknown, format: string): void {
  if (format === "json") {
    context.stdout(json(value) + "\n");
    return;
  }
  if (format === "ndjson") {
    context.stdout(json(value) + "\n");
    return;
  }
  const safe = redactKeys(value);
  const items = pageItems(safe);
  if (items.length && isRecord(items[0])) {
    const columns = Object.keys(items[0])
      .filter((k) =>
        [
          "id",
          "name",
          "email",
          "status",
          "amount",
          "balance",
          "price",
          "currency",
          "object",
        ].includes(k),
      )
      .slice(0, 7);
    if (!columns.length) {
      context.stdout(redact(JSON.stringify(safe, null, 2), [...context.secrets]) + "\n");
      return;
    }
    const table = new Table({
      head: columns,
      style: { head: [], border: [] },
      chars: context.isTTY
        ? undefined
        : {
            top: "-",
            "top-mid": "+",
            "top-left": "+",
            "top-right": "+",
            bottom: "-",
            "bottom-mid": "+",
            "bottom-left": "+",
            "bottom-right": "+",
            left: "|",
            "left-mid": "+",
            mid: "-",
            "mid-mid": "+",
            right: "|",
            "right-mid": "+",
            middle: "|",
          },
    });
    for (const item of items)
      if (isRecord(item)) table.push(columns.map((k) => humanValue(item[k])));
    context.stdout(redact(table.toString(), [...context.secrets]) + "\n");
  } else context.stdout(redact(JSON.stringify(safe, null, 2), [...context.secrets]) + "\n");
}
