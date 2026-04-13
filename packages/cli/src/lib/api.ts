import { Creem } from "creem";
import { getConfigValue } from "./config";
import { resetEnvCache } from "./env-cache";

const API_URLS = {
  live: "https://api.creem.io",
  test: "https://test-api.creem.io",
} as const;

let clientInstance: Creem | null = null;
let cachedApiKey: string | null = null;
let cachedEnvironment: string | null = null;

/**
 * Gets the base URL for the current environment
 */
export function getBaseUrl(): string {
  const env = getConfigValue("environment");
  return API_URLS[env] || API_URLS.test;
}

/**
 * Gets or creates a Creem SDK client instance
 * Recreates client if API key or environment changed
 */
export function getClient(): Creem {
  const apiKey = getConfigValue("api_key");

  if (!apiKey) {
    throw new Error("Not authenticated. Run `creem login` first.");
  }

  const environment = getConfigValue("environment");

  // Recreate client if API key or environment changed
  if (
    !clientInstance ||
    apiKey !== cachedApiKey ||
    environment !== cachedEnvironment
  ) {
    clientInstance = new Creem({
      apiKey,
      // 0 = live (api.creem.io), 1 = test (test-api.creem.io)
      serverIdx: environment === "live" ? 0 : 1,
    });
    cachedApiKey = apiKey;
    cachedEnvironment = environment;
  }

  return clientInstance;
}

/**
 * Resets the client (call after login/logout)
 * Also resets the TUI environment cache to ensure UI shows current environment
 */
export function resetClient(): void {
  clientInstance = null;
  cachedApiKey = null;
  cachedEnvironment = null;
  resetEnvCache();
}

/**
 * Validates an API key by making a test request
 * @param apiKey - The API key to validate
 * @param environment - Optional environment override (defaults to config value)
 */
export async function validateApiKey(
  apiKey: string,
  environment?: "test" | "live",
): Promise<{ valid: boolean; error?: string }> {
  const env = environment ?? getConfigValue("environment");

  try {
    const testClient = new Creem({
      apiKey,
      serverIdx: env === "live" ? 0 : 1,
    });

    // Make a simple API call to validate the key
    await testClient.products.search(1, 1);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { valid: false, error: message };
  }
}
