import { Creem } from "creem";
import { getConfigValue, loadConfig } from "./config";
import { resetEnvCache } from "./env-cache";
import { CliError, redact } from "./errors";
import { isRecord } from "./operation";

export function inferEnvironment(key: string): "test" | "live" {
  if (key.startsWith("creem_test_")) return "test";
  if (key.startsWith("creem_")) return "live";
  throw new CliError(
    "Invalid API key format.",
    3,
    "Set CREEM_API_KEY from the dashboard developers page, or run creem login.",
  );
}
export function resolveAuth(explicitEnvironment?: "test" | "live") {
  const config = loadConfig();
  const environmentKey = process.env.CREEM_API_KEY?.trim();
  const apiKey = environmentKey || config.api_key;
  if (!apiKey) throw new CliError("Not authenticated.", 3, "Set CREEM_API_KEY or run creem login.");
  const inferred = inferEnvironment(apiKey);
  const environment = explicitEnvironment ?? (environmentKey ? inferred : config.environment);
  if (environment !== inferred)
    throw new CliError(
      "API key and selected environment do not match.",
      3,
      `Select --environment ${inferred} or provide a key for the selected environment.`,
    );
  return { apiKey, environment };
}
export function getBaseUrl(): string {
  const environment = process.env.CREEM_API_KEY
    ? inferEnvironment(process.env.CREEM_API_KEY.trim())
    : getConfigValue("environment");
  return environment === "live" ? "https://api.creem.io" : "https://test-api.creem.io";
}
export function getClient(
  options: { environment?: "test" | "live"; timeout?: number } = {},
): Creem {
  const { apiKey, environment } = resolveAuth(options.environment);
  return new Creem({
    apiKey,
    server: environment === "live" ? "prod" : "test",
    timeoutMs: options.timeout ?? 30000,
    retryConfig: { strategy: "none" },
  });
}
/**
 * The store's key for one environment, for commands that work on test and live
 * together: `CREEM_LIVE_API_KEY` / `CREEM_TEST_API_KEY`, else the current key
 * (`CREEM_API_KEY` or `creem login`'s) when it is that environment's. Undefined
 * when there is none; a variable that holds the other environment's key is an
 * error.
 */
export function environmentApiKey(environment: "test" | "live"): string | undefined {
  const name = environment === "live" ? "CREEM_LIVE_API_KEY" : "CREEM_TEST_API_KEY";
  const specific = process.env[name]?.trim();
  if (specific) {
    if (inferEnvironment(specific) !== environment)
      throw new CliError(
        `${name} is not a ${environment} key.`,
        3,
        `Set ${name} to the store's ${environment} key from the dashboard developers page.`,
      );
    return specific;
  }
  const current = process.env.CREEM_API_KEY?.trim() || loadConfig().api_key?.trim();
  return current && inferEnvironment(current) === environment ? current : undefined;
}
export function getEnvironmentClient(
  environment: "test" | "live",
  apiKey: string,
  timeout?: number,
): Creem {
  return new Creem({
    apiKey,
    server: environment === "live" ? "prod" : "test",
    timeoutMs: timeout ?? 30000,
    retryConfig: { strategy: "none" },
  });
}
export function resetClient(): void {
  resetEnvCache();
}
export async function validateApiKey(
  apiKey: string,
  environment?: "test" | "live",
): Promise<{ valid: boolean; error?: string }> {
  try {
    const env = environment ?? inferEnvironment(apiKey);
    const client = new Creem({
      apiKey,
      server: env === "live" ? "prod" : "test",
      retryConfig: { strategy: "none" },
      timeoutMs: 30000,
    });
    await client.products.search({ pageNumber: 1, pageSize: 1 });
    return { valid: true };
  } catch (error) {
    // A 403 proves that the API recognized the key, but the key does not have
    // access to the product-list probe. Authorization remains operation-specific.
    if (isRecord(error) && error.statusCode === 403) return { valid: true };
    return {
      valid: false,
      error: redact(error instanceof Error ? error.message : "Authentication failed", [apiKey]),
    };
  }
}
