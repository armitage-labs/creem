import { it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync, statSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as config from "../src/lib/config";
import { resolveAuth, getClient } from "../src/lib/api";
import { getAuthInfo } from "../src/lib/auth";
afterEach(() => vi.unstubAllEnvs());
it("environment key takes precedence without config writes and infers mode", () => {
  vi.stubEnv("CREEM_API_KEY", "creem_test_ephemeral");
  vi.spyOn(config, "loadConfig").mockReturnValue({
    api_key: "creem_live_stored",
    environment: "live",
    output_format: "table",
  });
  const save = vi.spyOn(config, "saveConfig");
  expect(resolveAuth()).toEqual({ apiKey: "creem_test_ephemeral", environment: "test" });
  getClient();
  expect(save).not.toHaveBeenCalled();
  expect(getAuthInfo().environment).toBe("test");
});
it("explicit mode conflicts and absent credentials fail with auth exit", () => {
  vi.stubEnv("CREEM_API_KEY", "creem_test_ephemeral");
  expect(() => resolveAuth("live")).toThrow("do not match");
  vi.stubEnv("CREEM_API_KEY", "");
  vi.spyOn(config, "loadConfig").mockReturnValue({ environment: "test", output_format: "table" });
  expect(() => resolveAuth()).toThrow("Not authenticated");
});
it("legacy configuration remains usable", () => {
  vi.stubEnv("CREEM_API_KEY", "");
  vi.spyOn(config, "loadConfig").mockReturnValue({
    api_key: "creem_test_stored",
    environment: "test",
    output_format: "table",
  });
  expect(resolveAuth().apiKey).toBe("creem_test_stored");
});
it("configuration permissions are repaired on an existing directory and file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-auth-"));
  vi.resetModules();
  vi.doMock("os", () => ({ homedir: () => dir }));
  try {
    const isolated = await import("../src/lib/config");
    isolated.saveConfig({
      environment: "test",
      output_format: "table",
      api_key: "creem_test_fixture",
    });
    chmodSync(join(dir, ".creem"), 0o755);
    chmodSync(isolated.getConfigPath(), 0o644);
    isolated.saveConfig({ environment: "test", output_format: "table" });
    expect(statSync(join(dir, ".creem")).mode & 0o777).toBe(0o700);
    expect(statSync(isolated.getConfigPath()).mode & 0o777).toBe(0o600);
  } finally {
    vi.doUnmock("os");
    vi.resetModules();
    rmSync(dir, { recursive: true, force: true });
  }
});
