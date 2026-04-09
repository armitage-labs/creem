import { getConfigValue } from './config';

/**
 * Cache the environment string to avoid sync file I/O on every render frame.
 * This is a shared utility used by both the API layer and TUI renderer.
 */
let cachedEnv: string | null = null;

/**
 * Gets the cached environment value, reading from config only on first call.
 */
export function getCachedEnv(): string {
  if (cachedEnv === null) {
    cachedEnv = getConfigValue('environment') || 'test';
  }
  return cachedEnv;
}

/**
 * Resets the cached environment string.
 * Call this when the environment config changes to ensure fresh reads.
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
