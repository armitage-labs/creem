import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staging = process.env.CLI_PACK_DIR ?? mkdtempSync(join(tmpdir(), "creem-cli-pack-"));
function command(bin, args, cwd, env = process.env) {
  const r = spawnSync(bin, args, { cwd, env, encoding: "utf8", timeout: 180000 });
  assert.equal(
    r.status,
    0,
    `${bin} ${args.join(" ")} failed:\n${r.error ?? ""}\n${r.stdout}\n${r.stderr}`,
  );
  return r;
}
try {
  if (!process.argv.includes("--install-only")) {
    command(
      "npm",
      ["pack", "--dry-run", "--ignore-scripts", "--cache", join(staging, "npm-cache")],
      root,
    );
    command("pnpm", ["pack", "--pack-destination", staging], resolve(root, "../sdk"));
    command("pnpm", ["pack", "--pack-destination", staging], root);
  }
  if (!process.argv.includes("--pack-only")) {
    const tarballs = readdirSync(staging)
      .filter((f) => f.endsWith(".tgz"))
      .map((f) => join(staging, f));
    assert.equal(tarballs.length, 2, "Expected CLI and workspace SDK tarballs");
    writeFileSync(
      join(staging, "package.json"),
      JSON.stringify({ name: "creem-cli-install-check", private: true, version: "1.0.0" }),
    );
    command(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--cache",
        join(staging, "npm-cache"),
        ...tarballs,
      ],
      staging,
    );
    const bin = join(staging, "node_modules/.bin/creem");
    const manifest = JSON.parse(readFileSync(resolve(root, "src/operation-manifest.json"), "utf8"));
    const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
    assert.equal(command(bin, ["--version"], staging).stdout.trim(), version);
    command(bin, ["--help"], staging);
    for (const resource of new Set(manifest.map((r) => r.cliPath.split(" ")[0])))
      command(bin, [resource, "--help"], staging);
    for (const row of manifest) command(bin, [...row.cliPath.split(" "), "--help"], staging);
    const preload = join(staging, "fixtures.cjs");
    writeFileSync(
      preload,
      `globalThis.fetch = async request => {
      if (!String(request.url ?? request).startsWith('https://test-api.creem.io/v1/products/search')) throw new Error('Unexpected fixture request');
      return process.env.CLI_PACK_ERROR === '1'
        ? Response.json({message:'Invalid fixture key',trace_id:'packed-trace'},{status:401})
        : Response.json({items:[],pagination:{current_page:1,total_pages:1,total_records:0,next_page:0,prev_page:0}});
    };`,
    );
    const env = {
      ...process.env,
      CREEM_API_KEY: "creem_test_pack_fixture",
      NODE_OPTIONS: `--require ${preload}`,
    };
    const success = command(bin, ["products", "list", "--json"], staging, env);
    assert.deepEqual(JSON.parse(success.stdout).items, []);
    assert.equal(success.stderr, "");
    const failure = spawnSync(bin, ["products", "list", "--json"], {
      cwd: staging,
      env: { ...env, CLI_PACK_ERROR: "1" },
      encoding: "utf8",
    });
    assert.equal(failure.status, 3);
    assert.equal(failure.stdout, "");
    assert.equal(JSON.parse(failure.stderr).error.traceId, "packed-trace");
    console.log(
      `Packed CLI installed and verified on ${process.version}: version, root/resource/all 55 operation help, real SDK JSON success and API error.`,
    );
  }
} finally {
  if (!process.env.CLI_PACK_DIR) rmSync(staging, { recursive: true, force: true });
}
