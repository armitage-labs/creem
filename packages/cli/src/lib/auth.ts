import { loadConfig, saveConfig, isAuthenticated, getConfigValue } from "./config";
import { validateApiKey, resetClient, inferEnvironment, resolveAuth } from "./api";

export interface LoginResult {
  success: boolean;
  message: string;
}

/**
 * Detects environment from API key prefix
 * creem_test_xxx -> test
 * creem_live_xxx or creem_xxx (non-test) -> live
 * Invalid prefix -> throws error
 */
export function detectEnvironment(apiKey: string): "test" | "live" {
  return inferEnvironment(apiKey);
}

/**
 * Logs in with an API key
 */
export async function loginWithApiKey(apiKey: string): Promise<LoginResult> {
  // Validate the API key format
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      success: false,
      message: "API key cannot be empty",
    };
  }

  const trimmedKey = apiKey.trim();

  // Auto-detect environment from API key prefix
  let detectedEnv: "test" | "live";
  try {
    detectedEnv = detectEnvironment(trimmedKey);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invalid API key format",
    };
  }

  // Validate the API key against the API using detected environment
  // (don't save config until validation succeeds)
  const validation = await validateApiKey(trimmedKey, detectedEnv);

  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || "Failed to validate API key",
    };
  }

  // Save config only after successful validation
  const config = loadConfig();
  config.environment = detectedEnv;
  config.api_key = trimmedKey;
  saveConfig(config);
  resetClient(); // Reset client to pick up new key and environment

  return {
    success: true,
    message: `Successfully logged in (${detectedEnv} environment)`,
  };
}

/**
 * Logs out the current user
 */
export function logout(): LoginResult {
  if (!isAuthenticated()) {
    return {
      success: true,
      message: "Already logged out",
    };
  }

  // Clear only the API key, preserve other settings
  const config = loadConfig();
  delete config.api_key;
  saveConfig(config);
  resetClient(); // Reset client after logout

  return {
    success: true,
    message: "Successfully logged out",
  };
}

/**
 * Gets info about the current authentication state
 */
export function getAuthInfo(): {
  authenticated: boolean;
  environment: "test" | "live";
  apiKeyPreview?: string;
} {
  const authenticated = isAuthenticated();
  const environment = authenticated ? resolveAuth().environment : getConfigValue("environment");

  let apiKeyPreview: string | undefined;
  if (authenticated) {
    const apiKey = resolveAuth().apiKey;
    if (apiKey) {
      // Show first 8 and last 4 characters
      if (apiKey.length > 16) {
        apiKeyPreview = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
      } else {
        apiKeyPreview = `${apiKey.slice(0, 4)}...`;
      }
    }
  }

  return {
    authenticated,
    environment,
    apiKeyPreview,
  };
}
