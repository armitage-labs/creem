import { Command, Option } from "commander";
import { SubscriptionStatus } from "creem/models/components";
import { operationManifest, type OperationMapping, type InputSchema } from "../operation-manifest";
import type { CliContext } from "../lib/context";
import { handlers } from "./operations";
import {
  parseInput,
  parseInteger,
  parseEnum,
  parseJsonValue,
  parseKeyValue,
  readData,
  validateSchema,
  validateOperation,
} from "../lib/input";
import { CliError } from "../lib/errors";
import { pages, pageItems } from "../lib/pagination";
import { isRecord } from "../lib/operation";
import { writeResult } from "../utils/results";
import { shouldOutputJson } from "../lib/config";

export function addGlobalOptions(command: Command): Command {
  return command
    .option("--json", "Output JSON")
    .addOption(
      new Option("--output <format>", "Output format").choices(["table", "json", "ndjson"]),
    )
    .option("--no-color", "Disable ANSI colors")
    .option("--timeout <ms>", "Request timeout in milliseconds", (v) =>
      parseInteger("--timeout", v, { min: 1 }),
    )
    .addOption(
      new Option("--environment <mode>", "API environment (must match key)").choices([
        "test",
        "live",
      ]),
    )
    .option("--yes", "Confirm this operation for automation");
}
export function outputFormat(command: Command): string {
  const opts = command.optsWithGlobals();
  return opts.json ? "json" : (opts.output ?? (shouldOutputJson() ? "json" : "table"));
}
function attribute(flag: string): string {
  return flag.replace(/^--/, "").replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}
function addInputFlag(command: Command, flag: string, schema: InputSchema, name: string): void {
  if (command.options.some((o) => o.long === flag)) return;
  const type = schema.type;
  const description = `${name}${schema.enum ? ` (${schema.enum.join("|")})` : ""}${type === "array" ? " (repeatable; JSON for objects)" : ""}`;
  if (type === "array" || name === "metadata")
    command.option(`${flag} <value>`, description, (v: string, previous: string[] = []) => [
      ...previous,
      v,
    ]);
  else if (type === "boolean")
    command.option(`${flag} [boolean]`, description, (v) => parseInput(name, v, schema));
  else command.option(`${flag} <value>`, description, (v) => parseInput(name, v, schema));
}
export function createResourceCommand(resource: string, context: CliContext): Command {
  const root = addGlobalOptions(new Command(resource).description(`Manage ${resource}`));
  const aliases: Record<string, string> = {
    customers: "cust",
    subscriptions: "subs",
    transactions: "txn",
    "customer-credits": "credits",
  };
  if (aliases[resource]) root.alias(aliases[resource]);
  root.action(async () => {
    if (
      context.isTTY &&
      outputFormat(root) === "table" &&
      ["products", "customers", "subscriptions", "transactions"].includes(resource)
    ) {
      const { launchResource } = await import("../tui/resources.js");
      const options = root.optsWithGlobals();
      const client = context.client({ environment: options.environment, timeout: options.timeout });
      await launchResource(resource, { ...context, client: () => client });
      return;
    }
    root.outputHelp();
  });
  for (const row of operationManifest.filter((r) => r.cliPath.startsWith(resource + " "))) {
    const parts = row.cliPath.split(" ").slice(1);
    let parent = root;
    for (const name of parts.slice(0, -1)) {
      let group = parent.commands.find((c) => c.name() === name);
      if (!group) {
        group = addGlobalOptions(new Command(name));
        parent.addCommand(group);
      }
      parent = group;
    }
    const command = addGlobalOptions(new Command(parts.at(-1)!)).description(row.description);
    const positional = row.parameters.find((p) => !p.cliFlagOrArgument.startsWith("--"));
    if (positional || row.argument)
      command.argument(positional?.cliFlagOrArgument ?? row.argument!, "Resource ID");
    for (const p of row.parameters) {
      if (p === positional) continue;
      if (row.cliPath === "customers get" && p.sdkName === "email")
        command.option(
          "--email [email]",
          "Retrieve by email; supports the legacy positional email",
        );
      else addInputFlag(command, p.cliFlagOrArgument, p.schema, p.sdkName);
    }
    if (row.body) {
      command.option(
        "--data <json|@file|->",
        "Complete SDK camelCase request body; excludes body flags",
      );
      for (const [field, flag] of Object.entries(row.body.primaryFlags)) {
        const schema =
          field === "customer.email" || (field === "customer" && resource === "checkouts")
            ? { type: "string" }
            : (row.body.schema.properties?.[field] ?? {});
        addInputFlag(command, flag, schema, field);
      }
    }
    if (row.pagination !== "none")
      command.option("--all", "Fetch every page from the supplied page/cursor");
    if (row.cliPath === "subscriptions list")
      command.option(
        "--status <status>",
        "Client-side filter across all pages (cannot combine with --page/--limit)",
        (v) => parseEnum("status", v, Object.values(SubscriptionStatus)),
      );
    command.action(async (...args: unknown[]) => {
      const cmd = args.at(-1) as Command;
      const id = positional || row.argument ? (args[0] as string | undefined) : undefined;
      await executeOperation(row, cmd, context, id);
    });
    parent.addCommand(command);
  }
  return root;
}
export async function executeOperation(
  row: OperationMapping,
  command: Command,
  context: CliContext,
  id?: string,
): Promise<void> {
  const opts = command.optsWithGlobals();
  const format = outputFormat(command);
  const p: Record<string, unknown> = {};
  let b: Record<string, unknown> = {};
  for (const param of row.parameters) {
    const value = param.cliFlagOrArgument.startsWith("--")
      ? opts[attribute(param.cliFlagOrArgument)]
      : id;
    if (value !== undefined) p[param.sdkName] = value;
    if (param.required && value === undefined)
      throw new CliError(`${param.cliFlagOrArgument} is required.`);
  }
  if (row.cliPath === "customers get" && opts.email === true) {
    p.email = id;
    delete p.customerId;
  }
  if (row.body) {
    const bodyFlags = Object.values(row.body.primaryFlags).filter(
      (flag) => opts[attribute(flag)] !== undefined,
    );
    if (opts.data !== undefined && bodyFlags.length)
      throw new CliError(
        "--data cannot be combined with body flags. Path IDs and non-body flags remain allowed.",
      );
    if (opts.data !== undefined) b = await readData(opts.data, context.stdin);
    else
      for (const [field, flag] of Object.entries(row.body.primaryFlags)) {
        const value = opts[attribute(flag)];
        if (value === undefined) continue;
        const schema = row.body.schema.properties?.[field] ?? {};
        if (field === "metadata") b[field] = parseKeyValue(value);
        else if (field === "customer" && row.cliPath === "checkouts create")
          b.customer = { id: value };
        else if (field === "customer.email") {
          if (opts.customer)
            throw new CliError("--customer and --customer-email are mutually exclusive.");
          b.customer = { email: value };
        } else if (schema.type === "array") {
          const values: string[] = value;
          b[field] =
            schema.items?.type === "string"
              ? values.flatMap((v) => (field === "appliesToProducts" ? v.split(",") : v))
              : values.map(parseJsonValue);
        } else if (schema.properties || schema.type === "object") b[field] = parseJsonValue(value);
        else b[field] = parseInput(field, value, schema);
      }
    if (row.body.positional && id) {
      const field = row.body.positional;
      if (b[field] !== undefined && b[field] !== id)
        throw new CliError(`Positional ID conflicts with --data ${field}.`);
      b[field] = id;
    }
    if (row.cliPath === "moderation screen" && b.prompt === "-") {
      if (opts.data === "-") throw new CliError("Stdin cannot supply both --data and prompt text.");
      b.prompt = await context.stdin();
    }
    // Preserve the historical singular image request for one --image-url.
    if (opts.data === undefined && Array.isArray(b.imageUrls) && b.imageUrls.length === 1) {
      b.imageUrl = b.imageUrls[0];
      delete b.imageUrls;
    }
    if (typeof b.key === "string") context.secrets.add(b.key);
    validateSchema(b, row.body.schema);
    if (typeof b.expiryDate === "string") b.expiryDate = new Date(b.expiryDate);
  }
  for (const param of row.parameters)
    if (p[param.sdkName] !== undefined)
      validateSchema(p[param.sdkName], param.schema, `parameters.${param.sdkName}`);
  validateOperation(row, p, b);
  if (
    row.cliPath === "subscriptions list" &&
    opts.status &&
    (opts.page !== undefined || opts.limit !== undefined)
  )
    throw new CliError("--status traverses every page; do not combine with --page or --limit.");
  const client = context.client({ environment: opts.environment, timeout: opts.timeout });
  if (
    row.destructive &&
    !(row.cliPath === "subscriptions cancel" && b.mode === "scheduled") &&
    !opts.yes
  ) {
    if (!context.isTTY || format !== "table")
      throw new CliError(
        "This operation requires --yes in non-interactive or machine-output mode.",
      );
    const environment = opts.environment ?? context.environment();
    if (
      !(await context.confirm(
        `${environment === "live" ? "LIVE" : "TEST"}: ${row.cliPath}${id ? " " + id : ""}?`,
      ))
    )
      throw new CliError("Operation canceled.");
  }
  const handler = handlers[row.operationId];
  const all = Boolean(opts.all || (row.cliPath === "subscriptions list" && opts.status));
  let result: unknown;
  const collected: unknown[] = [];
  for await (const page of pages(row, p, all, (parameters) =>
    handler(client, parameters, b, { timeoutMs: opts.timeout, retries: { strategy: "none" } }),
  )) {
    result = page;
    const items = pageItems(page).filter(
      (item) =>
        !opts.status ||
        row.cliPath !== "subscriptions list" ||
        (isRecord(item) && item.status === opts.status),
    );
    if (format === "ndjson") {
      if (row.pagination === "none") writeResult(context, page, format);
      else for (const item of items) writeResult(context, item, format);
    } else if (all) collected.push(...items);
  }
  if (format === "ndjson") return;
  if (all) {
    if (row.cliPath === "subscriptions list" && opts.status)
      result = {
        items: collected,
        filter: { status: opts.status, scope: "client" },
        totalRecords: collected.length,
      };
    else if (row.pagination === "cursor")
      result = { ...(isRecord(result) ? result : {}), data: collected, hasMore: false };
    else
      result = {
        items: collected,
        pagination: { currentPage: 1, totalPages: 1, totalRecords: collected.length },
      };
  }
  writeResult(context, result, format);
}
