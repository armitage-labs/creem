import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const packageName = "@creem_io/cli";
const registry = "https://registry.npmjs.org";
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function publishedCliVersion(publishedPackages) {
  const packages = JSON.parse(publishedPackages);
  if (!Array.isArray(packages)) throw new Error("Expected Changesets publishedPackages array.");
  const cli = packages.filter((pkg) => pkg.name === packageName);
  if (cli.length > 1) throw new Error("Multiple published CLI versions in one release.");
  return cli.length ? validateVersion(cli[0].version) : "";
}

export function validateVersion(version) {
  if (typeof version !== "string" || !stableVersion.test(version)) {
    throw new Error("Expected an exact stable CLI version, e.g. 0.3.0.");
  }
  return version;
}

export function compareVersions(left, right) {
  const a = validateVersion(left).split(".").map(BigInt);
  const b = validateVersion(right).split(".").map(BigInt);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

export function formulaVersion(source) {
  const explicit = source.match(/^  version "([^"]+)"$/m);
  const url = source.match(/^  url "([^"]+)"$/m)?.[1];
  const version = explicit?.[1] ?? url?.match(/(?:creem-cli-|\/cli-)(\d+\.\d+\.\d+)\.tgz$/)?.[1];
  return validateVersion(version);
}

export function updateFormula(source, version, sha256) {
  validateVersion(version);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Invalid SHA-256.");
  if (compareVersions(formulaVersion(source), version) >= 0) return source;
  for (const field of ["url", "sha256"]) {
    if ((source.match(new RegExp(`^  ${field} "[^"\\n]+"$`, "gm")) ?? []).length !== 1) {
      throw new Error(`Expected exactly one ${field} in the formula.`);
    }
  }
  return source
    .replace(/^  url "[^"]+"$/m, `  url "${registry}/${packageName}/-/cli-${version}.tgz"`)
    .replace(/^  sha256 "[^"]+"$/m, `  sha256 "${sha256}"`)
    .replace(/^  version "[^"]+"$/m, `  version "${version}"`);
}

// Retry registry propagation delays and transient network failures, never a bad artifact.
export async function fetchWithRetry(url, { fetchImpl = fetch, wait = sleep } = {}) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
      if (response.ok) return response;
      const retryable = [404, 429].includes(response.status) || response.status >= 500;
      await response.body?.cancel();
      if (!retryable)
        throw new Error(`Registry returned HTTP ${response.status} for ${url}`, {
          cause: "permanent",
        });
      if (attempt === 6)
        throw new Error(`Registry returned HTTP ${response.status} for ${url}`, {
          cause: "permanent",
        });
    } catch (error) {
      if (error.cause === "permanent" || attempt === 6) throw error;
    }
    await wait(10_000);
  }
}

export async function publishedArtifact(version, options) {
  validateVersion(version);
  const metadata = await (
    await fetchWithRetry(`${registry}/${packageName}/${version}`, options)
  ).json();
  const tarball = `${registry}/${packageName}/-/cli-${version}.tgz`;
  if (
    metadata.name !== packageName ||
    metadata.version !== version ||
    metadata.dist?.tarball !== tarball
  ) {
    throw new Error("npm metadata does not match the requested CLI package, version, and tarball.");
  }
  const integrity = metadata.dist.integrity;
  if (typeof integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
    throw new Error("npm metadata is missing SHA-512 integrity.");
  }
  const bytes = Buffer.from(await (await fetchWithRetry(tarball, options)).arrayBuffer());
  const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (actual !== integrity) throw new Error("npm tarball failed its integrity check.");
  return { tarball, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function main(version, formulaPath) {
  validateVersion(version);
  if (!formulaPath) throw new Error("Usage: node scripts/update-homebrew.mjs VERSION FORMULA_PATH");
  const source = readFileSync(formulaPath, "utf8");
  let changed = false;
  if (compareVersions(formulaVersion(source), version) < 0) {
    const { sha256 } = await publishedArtifact(version);
    const updated = updateFormula(source, version, sha256);
    writeFileSync(formulaPath, updated);
    changed = true;
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nchanged=${changed}\n`);
  }
  console.log(changed ? `Updated formula to ${version}.` : "Formula is already current or newer.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
