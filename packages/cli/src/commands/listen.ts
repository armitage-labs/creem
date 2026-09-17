import { Command } from "commander";
import chalk from "chalk";
import { hostname } from "node:os";
import type { Creem } from "creem";
import {
  WebhookDeliveryMode,
  WebhookEventType,
  type WebhookPendingEventEntity,
} from "creem/models/components";
import { createContext, type CliContext } from "../lib/context";
import { CliError } from "../lib/errors";
import { parseInteger } from "../lib/input";
import { addGlobalOptions, outputFormat } from "./resource";
import { json } from "../utils/results";

/**
 * `creem listen` — receive webhooks on this machine without a tunnel.
 *
 * Creates a temporary `cli` delivery-mode endpoint, polls its pending-events
 * feed, forwards each event to a local URL with the exact body and headers a
 * real delivery carries (so signature verification runs for real), reports the
 * local result back, and deletes the endpoint on exit.
 *
 * At-least-once, like HTTP delivery: an event stays in the feed until it is
 * acknowledged, so a crash between forward and ack replays it. A local handler
 * must therefore be idempotent — the same rule as production.
 */

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_FORWARD_TIMEOUT_MS = 15_000;
const POLL_PAGE_SIZE = 100;
/** Matches the API's `response_body` limit for acknowledgements. */
const RESPONSE_BODY_LIMIT = 10_000;
const LOCAL_UNREACHABLE_STATUS = 503;

interface ListenOptions {
  forwardTo: string;
  events: string[];
  name?: string;
  webhook?: string;
  live?: boolean;
  once?: boolean;
  interval: number;
  forwardTimeout: number;
  environment?: "test" | "live";
  timeout?: number;
}

interface ForwardResult {
  statusCode: number;
  responseBody: string;
  durationMs: number;
  transportError?: string;
}

export function parseEventTypes(values: string[]): string[] {
  const types = values.flatMap((value) => value.split(",")).map((value) => value.trim());
  const known = Object.values(WebhookEventType) as string[];
  for (const type of types)
    if (!known.includes(type))
      throw new CliError(
        `Unknown event type: ${type}.`,
        2,
        `Use one or more of: ${known.join(", ")}.`,
      );
  return [...new Set(types)];
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

async function forward(
  target: string,
  event: WebhookPendingEventEntity,
  timeoutMs: number,
): Promise<ForwardResult> {
  const started = performance.now();
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: event.headers,
      body: event.body,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });
    const responseBody = (await response.text()).slice(0, RESPONSE_BODY_LIMIT);
    return {
      statusCode: response.status,
      responseBody,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    // The API records this as a failed delivery, the same way an HTTP endpoint
    // that refused the connection would show up in the dashboard.
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      statusCode: LOCAL_UNREACHABLE_STATUS,
      responseBody: `creem listen could not reach ${target}: ${message}`,
      durationMs: Math.round(performance.now() - started),
      transportError: message,
    };
  }
}

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function createListenCommand(context: CliContext = createContext()): Command {
  const command = addGlobalOptions(
    new Command("listen").description(
      "Receive your store's webhooks on this machine and forward them to a local URL",
    ),
  )
    .requiredOption("--forward-to <url>", "Local URL that receives the forwarded webhook requests")
    .option(
      "--events <types>",
      "Only listen for these event types (comma-separated; repeatable)",
      (value: string, previous: string[] = []) => [...previous, value],
      [],
    )
    .option("--name <name>", "Label for the temporary endpoint in the dashboard")
    .option(
      "--webhook <id>",
      "Reuse an existing CLI-mode endpoint instead of creating a temporary one (never deleted)",
    )
    .option("--live", "Allow listening in live mode (real customer events)")
    .option("--once", "Forward the events that are pending right now, then exit")
    .option(
      "--interval <ms>",
      `Poll interval in milliseconds (default ${DEFAULT_POLL_INTERVAL_MS})`,
      (value) => parseInteger("--interval", value, { min: 100 }),
      DEFAULT_POLL_INTERVAL_MS,
    )
    .option(
      "--forward-timeout <ms>",
      `How long to wait for the local server (default ${DEFAULT_FORWARD_TIMEOUT_MS})`,
      (value) => parseInteger("--forward-timeout", value, { min: 100 }),
      DEFAULT_FORWARD_TIMEOUT_MS,
    );

  command.action(async () => {
    const opts = command.optsWithGlobals() as ListenOptions;
    const format = outputFormat(command);
    const machine = format !== "table";
    const events = parseEventTypes(opts.events);

    let target: URL;
    try {
      target = new URL(opts.forwardTo);
    } catch {
      throw new CliError(
        `--forward-to must be a URL (got ${opts.forwardTo}).`,
        2,
        "Example: --forward-to http://localhost:3000/api/webhooks",
      );
    }

    const environment = opts.environment ?? context.environment();
    if (environment === "live" && !opts.live)
      throw new CliError(
        "Refusing to listen in live mode without --live.",
        2,
        "Live events are real customer activity. Switch to a test API key, or pass --live to forward them to your local server.",
      );

    const client: Creem = context.client({ environment, timeout: opts.timeout });

    const emit = (line: string) => context.stdout(line + "\n");
    const record = (value: Record<string, unknown>) => emit(json(value));

    // Set up the endpoint: a temporary one (deleted on exit) unless --webhook
    // points at an existing CLI-mode endpoint the developer manages themselves.
    let webhookId: string;
    let secret: string | undefined;
    const temporary = !opts.webhook;
    if (opts.webhook) {
      const existing = await client.webhooks.get(opts.webhook);
      if (existing.deliveryMode !== WebhookDeliveryMode.Cli)
        throw new CliError(
          `Webhook ${existing.id} is not a CLI-mode endpoint.`,
          2,
          'Pass a webhook created with delivery_mode "cli", or omit --webhook to create a temporary one.',
        );
      webhookId = existing.id;
      secret = (await client.webhooks.getSecret(webhookId)).secret;
    } else {
      const created = await client.webhooks.create({
        name: opts.name ?? `creem listen (${hostname()})`,
        deliveryMode: WebhookDeliveryMode.Cli,
        events: events as WebhookEventType[],
      });
      webhookId = created.id;
      secret = created.secret;
    }

    if (machine)
      record({
        type: "listening",
        webhook_id: webhookId,
        environment,
        forward_to: target.toString(),
        events,
        secret,
        temporary,
      });
    else {
      emit(
        `${chalk.green("Listening")} for ${chalk.bold(environment)}-mode webhooks on ${chalk.cyan(webhookId)}` +
          (events.length ? ` (${events.join(", ")})` : ""),
      );
      emit(`Forwarding to ${chalk.cyan(target.toString())}`);
      if (secret)
        emit(
          `Signing secret: ${chalk.yellow(secret)}  (verify the creem-signature header with it)`,
        );
      emit(
        temporary
          ? chalk.dim("Press Ctrl-C to stop; the temporary endpoint is deleted on exit.")
          : chalk.dim("Press Ctrl-C to stop."),
      );
      emit("");
    }

    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);

    let forwarded = 0;
    let failed = 0;
    let pollFailures = 0;
    try {
      while (!controller.signal.aborted) {
        let pending: WebhookPendingEventEntity[];
        try {
          pending = (await client.webhooks.listPendingEvents(webhookId, POLL_PAGE_SIZE)).items;
          pollFailures = 0;
        } catch (error) {
          if (controller.signal.aborted) break;
          pollFailures++;
          const message = describeError(error);
          if (machine) record({ type: "poll_error", message, attempt: pollFailures });
          else context.stderr(chalk.yellow(`${timestamp()}  poll failed: ${message}\n`));
          if (opts.once) throw error;
          // Back off, capped, so a Creem outage does not turn into a tight loop.
          await sleep(Math.min(opts.interval * 2 ** pollFailures, 30_000), controller.signal);
          continue;
        }

        for (const event of pending) {
          if (controller.signal.aborted) break;
          const result = await forward(target.toString(), event, opts.forwardTimeout);
          const acknowledgment = await client.webhooks.acknowledgeEvent(webhookId, event.id, {
            statusCode: result.statusCode,
            responseBody: result.responseBody,
          });
          // The first acknowledgment wins; another listener may have already
          // recorded a different outcome for this delivery.
          const success = acknowledgment.success;
          const localSuccess = result.statusCode >= 200 && result.statusCode < 300;
          forwarded++;
          if (!success) failed++;
          if (machine)
            record({
              type: "event",
              event_id: event.id,
              event_type: event.eventType,
              created_at: event.createdAt.toISOString(),
              status_code: result.statusCode,
              success,
              duration_ms: result.durationMs,
              ...(result.transportError ? { error: result.transportError } : {}),
            });
          else {
            const status = localSuccess
              ? chalk.green(String(result.statusCode))
              : chalk.red(String(result.statusCode));
            const detail = result.transportError
              ? chalk.red(`  ${result.transportError}`)
              : localSuccess
                ? ""
                : chalk.red("  failed");
            const storedOutcome =
              success === localSuccess
                ? ""
                : `  stored acknowledgment: ${success ? "succeeded" : "failed"}`;
            emit(
              `${chalk.dim(timestamp())}  ${event.eventType.padEnd(32)} ${chalk.dim(event.id)}  → ${status}  ${chalk.dim(`(${result.durationMs} ms)`)}${detail}${storedOutcome}`,
            );
          }
        }

        if (opts.once && pending.length < POLL_PAGE_SIZE) break;
        // Drain a backlog immediately; only idle-wait when the feed was empty.
        if (pending.length === 0) await sleep(opts.interval, controller.signal);
      }
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      if (temporary) {
        try {
          await client.webhooks.delete(webhookId);
          if (machine)
            record({ type: "stopped", webhook_id: webhookId, forwarded, failed, deleted: true });
          else
            emit(
              chalk.dim(
                `\nStopped. Removed temporary endpoint ${webhookId} (${forwarded} forwarded, ${failed} failed).`,
              ),
            );
        } catch (error) {
          const message = describeError(error);
          if (machine)
            record({
              type: "stopped",
              webhook_id: webhookId,
              forwarded,
              failed,
              deleted: false,
              error: message,
            });
          else
            context.stderr(
              chalk.yellow(
                `\nStopped, but could not delete endpoint ${webhookId}: ${message}\nRemove it with: creem webhooks delete ${webhookId} --yes\n`,
              ),
            );
        }
      } else if (machine)
        record({ type: "stopped", webhook_id: webhookId, forwarded, failed, deleted: false });
      else emit(chalk.dim(`\nStopped (${forwarded} forwarded, ${failed} failed).`));
    }
  });
  return command;
}
