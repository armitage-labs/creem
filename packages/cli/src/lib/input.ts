import { readFile } from "node:fs/promises";
import type { InputSchema, OperationMapping } from "../operation-manifest";
import { CliError } from "./errors";
import { isRecord } from "./operation";

export function parseInteger(
  name: string,
  value: unknown,
  bounds: { min?: number; max?: number } = {},
): number {
  if (!/^-?\d+$/.test(String(value))) throw new CliError(`${name} must be an integer.`);
  const n = Number(value);
  if (
    !Number.isSafeInteger(n) ||
    n < (bounds.min ?? 0) ||
    n > (bounds.max ?? Number.MAX_SAFE_INTEGER)
  )
    throw new CliError(
      `${name} is outside the allowed range (${bounds.min ?? 0}–${bounds.max ?? Number.MAX_SAFE_INTEGER}).`,
    );
  return n;
}
export function parseEnum(name: string, value: unknown, values: readonly unknown[]): unknown {
  if (!values.includes(value)) throw new CliError(`${name} must be one of: ${values.join(", ")}.`);
  return value;
}
export function parseDate(name: string, value: unknown): string {
  const text = String(value);
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(text) ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(text.slice(0, 10)).toISOString().slice(0, 10) !== text.slice(0, 10)
  )
    throw new CliError(`${name} must be a valid ISO-8601 date.`);
  return text;
}
export function parseJsonValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError("Invalid JSON. Use a JSON object with double-quoted keys.");
  }
}
export async function readData(
  value: string,
  stdin: () => Promise<string>,
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text =
      value === "-"
        ? await stdin()
        : value.startsWith("@")
          ? await readFile(value.slice(1), "utf8")
          : value;
  } catch {
    throw new CliError("Cannot read --data input. Check the file path and permissions.");
  }
  const data = parseJsonValue(text);
  if (!isRecord(data))
    throw new CliError("--data must contain a JSON object using SDK camelCase field names.");
  return data;
}
export function parseKeyValue(values: string[]): Record<string, string> {
  const entries = values.map((value) => {
    const i = value.indexOf("=");
    if (i < 1) throw new CliError("--metadata must be key=value.");
    return [value.slice(0, i), value.slice(i + 1)];
  });
  return Object.fromEntries(entries);
}
export function parseInput(name: string, value: unknown, schema: InputSchema): unknown {
  if (schema.enum) return parseEnum(name, value, schema.enum);
  if (schema.type === "integer" || schema.type === "number") {
    // Split percentages may be fractional; other numeric CLI inputs are integer units.
    if (name.includes("recipients") && name.endsWith("amount")) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1 || n > 100)
        throw new CliError(`${name} must be between 1 and 100.`);
      return n;
    }
    return parseInteger(name, value, { min: schema.minimum, max: schema.maximum });
  }
  if (schema.type === "boolean") {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    throw new CliError(`${name} must be true or false.`);
  }
  if (schema.format === "date-time" || /(?:createdAfter|createdBefore|\.at)$/.test(name))
    return parseDate(name, value);
  return value;
}
// Validate JSON as well as flags, including unknown fields that Zod would otherwise strip.
export function validateSchema(value: unknown, schema: InputSchema, name = "body"): void {
  if (value === null && schema.nullable) return;
  if (schema.properties) {
    if (!isRecord(value)) throw new CliError(`${name} must be an object.`);
    for (const required of schema.required ?? [])
      if (value[required] === undefined)
        throw new CliError(`${name}.${required} is required. Supply its flag or --data.`);
    for (const [key, field] of Object.entries(value)) {
      const child = Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
      if (!child) throw new CliError(`Unknown field ${name}.${key}. Use SDK camelCase names.`);
      validateSchema(field, child, `${name}.${key}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw new CliError(`${name} must be an array.`);
    value.forEach((v, i) => validateSchema(v, schema.items ?? {}, `${name}[${i}]`));
  } else if (schema.type === "object") {
    if (!isRecord(value)) throw new CliError(`${name} must be an object.`);
  } else {
    if (
      (schema.type && schema.type !== "integer" && typeof value !== schema.type) ||
      (schema.type === "integer" && typeof value !== "number")
    )
      throw new CliError(`${name} must be ${schema.type}.`);
    parseInput(name, value, schema);
  }
}
export function validateOperation(
  row: OperationMapping,
  p: Record<string, unknown>,
  b: Record<string, unknown>,
): void {
  if (p.startingAfter && p.endingBefore)
    throw new CliError("Use only one of --starting-after and --ending-before.");
  for (const key of ["pageNumber", "pageSize", "limit"])
    if (p[key] !== undefined)
      parseInteger(key, p[key], { min: 1, max: key === "pageNumber" ? undefined : 100 });
  if (row.cliPath === "customers get" && Boolean(p.customerId) === Boolean(p.email))
    throw new CliError("Supply a customer ID or --email, exclusively.");
  if (row.cliPath === "discounts get" && Boolean(p.discountId) === Boolean(p.discountCode))
    throw new CliError("Supply a discount ID or --code, exclusively.");
  if (row.cliPath.endsWith(" update") && !Object.keys(b).some((k) => k !== "customerId"))
    throw new CliError("Update requires at least one changed field.");
  if (row.cliPath === "subscriptions update" && (!Array.isArray(b.items) || !b.items.length))
    throw new CliError("Subscription update requires at least one --item or items in --data.");
  if (row.cliPath.startsWith("products ") && row.body) {
    if (b.price !== undefined && b.price !== 0) parseInteger("price", b.price, { min: 100 });
    if (
      b.billingType === "recurring" &&
      b.billingPeriod === undefined &&
      row.cliPath.endsWith("create")
    )
      throw new CliError("Recurring products require --billing-period.");
    if (b.billingPeriod === "custom") {
      const bounds: Record<string, number> = { day: 365, week: 52, month: 24, year: 3 };
      if (!b.recurringInterval || b.recurringIntervalCount === undefined)
        throw new CliError(
          "Custom billing requires --recurring-interval and --recurring-interval-count.",
        );
      parseInteger("recurringIntervalCount", b.recurringIntervalCount, {
        min: 1,
        max: bounds[String(b.recurringInterval)],
      });
    } else if (b.recurringInterval !== undefined || b.recurringIntervalCount !== undefined)
      throw new CliError("Custom cadence fields require --billing-period custom.");
    if (b.payWhatYouWant && b.billingType === "recurring")
      throw new CliError("Pay-what-you-want requires a one-time product.");
    if (
      typeof b.suggestedPrice === "number" &&
      typeof b.price === "number" &&
      b.suggestedPrice < b.price
    )
      throw new CliError("Suggested price must be at least price.");
    if (Array.isArray(b.imageUrls) && b.imageUrls.length > 8)
      throw new CliError("A product supports at most eight images.");
  }
  if (Array.isArray(b.customFields) && b.customFields.length > 3)
    throw new CliError("At most three custom fields are supported.");
  if (b.units !== undefined) parseInteger("units", b.units, { min: 1 });
  if (b.customPrice !== undefined)
    parseInteger("customPrice", b.customPrice, { min: 100, max: 99999999 });
  if (row.cliPath.startsWith("customer-credits"))
    for (const k of ["amount", "initialBalance"])
      if (
        b[k] !== undefined &&
        (!/^\d+$/.test(String(b[k])) || (k === "amount" && BigInt(String(b[k])) === 0n))
      )
        throw new CliError(
          `${k} must be a ${k === "amount" ? "positive" : "non-negative"} integer string.`,
        );
  if (row.cliPath === "stats summary") {
    if (p.interval && (p.startDate === undefined || p.endDate === undefined))
      throw new CliError("--interval requires --start-date and --end-date.");
    if (typeof p.startDate === "number" && typeof p.endDate === "number" && p.startDate > p.endDate)
      throw new CliError("Start date must be before end date.");
  }
  if (
    p.createdAfter &&
    p.createdBefore &&
    Date.parse(String(p.createdAfter)) > Date.parse(String(p.createdBefore))
  )
    throw new CliError("Created-after must precede created-before.");
  if (row.cliPath === "discounts create") {
    if (b.type === "fixed") {
      parseInteger("amount", b.amount, { min: 1 });
      if (!b.currency) throw new CliError("Fixed discounts require --currency.");
    }
    if (b.type === "percentage") parseInteger("percentage", b.percentage, { min: 1, max: 100 });
    for (const k of ["maxRedemptions", "durationInMonths"])
      if (b[k] !== undefined) parseInteger(k, b[k], { min: 1 });
    if (b.duration === "repeating" && !b.durationInMonths)
      throw new CliError("Repeating discounts require --duration-months.");
    if (!Array.isArray(b.appliesToProducts) || !b.appliesToProducts.length)
      throw new CliError("Provide at least one product in --products or appliesToProducts.");
  }
  if (row.cliPath === "splits create") {
    const recipients = b.recipients;
    if (!Array.isArray(recipients) || recipients.length < 1 || recipients.length > 10)
      throw new CliError("Splits require 1–10 recipients.");
    let total = 0;
    const seen = new Set<string>();
    for (const r of recipients) {
      if (!isRecord(r)) throw new CliError("Recipient must be an object.");
      const key = `${r.recipientType}:${r.recipientReference}`;
      if (seen.has(key)) throw new CliError("Duplicate split recipient.");
      seen.add(key);
      total += Number(r.amount);
    }
    if (total > 100) throw new CliError("Split percentages must total at most 100.");
  }
}
