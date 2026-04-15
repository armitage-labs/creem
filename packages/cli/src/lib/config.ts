import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface CreemConfig {
  api_key?: string;
  environment: "test" | "live";
  output_format: "table" | "json";
}

const DEFAULT_CONFIG: CreemConfig = {
  environment: "test",
  output_format: "table",
};

const CONFIG_DIR = path.join(os.homedir(), ".creem");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * Ensures the config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

const VALID_ENVIRONMENTS = ["test", "live"] as const;
const VALID_OUTPUT_FORMATS = ["table", "json"] as const;

/**
 * Validates and sanitizes config values
 */
function validateConfig(config: Partial<CreemConfig>): CreemConfig {
  const validated: CreemConfig = { ...DEFAULT_CONFIG };

  // Validate environment
  if (
    config.environment &&
    VALID_ENVIRONMENTS.includes(config.environment as "test" | "live")
  ) {
    validated.environment = config.environment as "test" | "live";
  }

  // Validate output_format
  if (
    config.output_format &&
    VALID_OUTPUT_FORMATS.includes(config.output_format as "table" | "json")
  ) {
    validated.output_format = config.output_format as "table" | "json";
  }

  // Copy api_key if present
  if (config.api_key) {
    validated.api_key = config.api_key;
  }

  return validated;
}

/**
 * Loads the config from disk
 */
export function loadConfig(): CreemConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return validateConfig(parsed);
    }
  } catch {
    // If config is corrupted, return defaults
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Saves the config to disk
 */
export function saveConfig(config: CreemConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Gets a specific config value
 */
export function getConfigValue<K extends keyof CreemConfig>(
  key: K,
): CreemConfig[K] {
  const config = loadConfig();
  return config[key];
}

/**
 * Sets a specific config value
 */
export function setConfigValue<K extends keyof CreemConfig>(
  key: K,
  value: CreemConfig[K],
): void {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

/**
 * Determines if JSON output should be used based on CLI flag and config
 */
export function shouldOutputJson(cliJsonFlag?: boolean): boolean {
  if (cliJsonFlag !== undefined) {
    return cliJsonFlag;
  }
  return getConfigValue("output_format") === "json";
}

/**
 * Gets the config file path (for display purposes)
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Checks if the user is authenticated
 */
export function isAuthenticated(): boolean {
  const config = loadConfig();
  return !!config.api_key;
}
