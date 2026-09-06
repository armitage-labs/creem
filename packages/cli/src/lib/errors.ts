import { CommanderError } from "commander";
import { isRecord } from "./operation";

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode = 2,
    public readonly suggestion = "Run the command with --help and correct the inputs.",
  ) {
    super(message);
    this.name = "CliError";
  }
}
export function redact(text: string, secrets: readonly string[] = []): string {
  for (const secret of secrets) if (secret) text = text.split(secret).join("[REDACTED]");
  return text.replace(/creem_(?:test_|live_)?[a-zA-Z0-9_-]+/g, "[REDACTED]");
}
export function describeError(error: unknown, secrets: readonly string[] = []) {
  const e = isRecord(error) ? error : {};
  const name = error instanceof Error ? error.name : "UnexpectedError";
  let details: unknown = null;
  if (typeof e.body === "string") {
    try {
      details = JSON.parse(e.body);
    } catch {
      details = e.body;
    }
  }
  const api = isRecord(details) ? details : {};
  const status = typeof e.statusCode === "number" ? e.statusCode : null;
  const validation =
    name !== "ResponseValidationError" && /ValidationError|ZodError|InvalidRequestError/.test(name);
  const network = /ConnectionError|Timeout|Abort|HTTPClientError|UnexpectedClientError/.test(name);
  const exitCode =
    error instanceof CliError
      ? error.exitCode
      : error instanceof CommanderError || validation
        ? 2
        : status === 401 || status === 403
          ? 3
          : status || name === "ResponseValidationError"
            ? 4
            : network
              ? 5
              : 1;
  const suggestions: Record<number, string> = {
    401: "Set a valid CREEM_API_KEY for the selected environment, or run creem login.",
    403: "Check the API key scopes and resource ownership in the selected environment.",
    404: "Check the resource ID and test/live environment.",
    409: "Check the current resource state and idempotency key before trying again.",
    429: "Wait for Retry-After. Check whether the write succeeded before retrying.",
  };
  const suggestion =
    error instanceof CliError
      ? error.suggestion
      : (suggestions[status ?? 0] ??
        (validation || error instanceof CommanderError
          ? "Run the command with --help and correct the inputs."
          : network
            ? "Check connectivity and --timeout. Verify write status before retrying."
            : "Check the request and service status; contact support with the trace ID. Verify writes before retrying."));
  const headers = e.headers instanceof Headers ? e.headers : undefined;
  const message = Array.isArray(api.message)
    ? api.message.join("; ")
    : typeof api.message === "string"
      ? api.message
      : error instanceof Error
        ? error.message
        : "Unexpected failure";
  const result = {
    error: {
      type:
        exitCode === 2
          ? "validation"
          : exitCode === 3
            ? "auth"
            : exitCode === 4
              ? "api"
              : exitCode === 5
                ? "network"
                : "unexpected",
      message,
      status,
      traceId:
        api.trace_id ??
        api.traceId ??
        headers?.get("x-trace-id") ??
        headers?.get("x-request-id") ??
        null,
      details,
      cause:
        e.cause instanceof Error ? e.cause.message : typeof e.cause === "string" ? e.cause : null,
      suggestion,
      retryAfter: headers?.get("retry-after") ?? null,
    },
  };
  return {
    exitCode,
    result: JSON.parse(
      JSON.stringify(result, (_key, value: unknown) =>
        typeof value === "string" ? redact(value, secrets) : value,
      ),
    ) as typeof result,
  };
}
