import { readFileSync, writeFileSync } from "node:fs";

// Changesets owns package.json. Keep this adapter limited to current release
// metadata: gen.lock, workflow.lock and RELEASES.md record past generations.
// `speakeasy bump` only updates gen.yaml; a full generation requires Speakeasy
// credentials and can change the API surface, so neither belongs in release CI.
const checkOnly = process.argv.slice(2).includes("--check");
const unexpectedArguments = process.argv.slice(2).filter((argument) => argument !== "--check");

if (unexpectedArguments.length > 0) {
  throw new Error(`Unexpected arguments: ${unexpectedArguments.join(", ")}`);
}

const sdkPackage = JSON.parse(readFileSync("packages/sdk/package.json", "utf8"));
const sdkVersion = sdkPackage.version;

if (
  typeof sdkVersion !== "string" ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(sdkVersion)
) {
  throw new Error(`Invalid SDK package version: ${String(sdkVersion)}`);
}

const updates = new Map();

function updateFile(path, transform) {
  const current = readFileSync(path, "utf8");
  const updated = transform(current);

  if (updated === current) return;

  updates.set(path, updated);
}

function replaceExactly(source, pattern, replacement, description) {
  const matches = source.match(
    new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`),
  );

  if (matches?.length !== 1) {
    throw new Error(`Expected exactly one ${description}, found ${matches?.length ?? 0}`);
  }

  return source.replace(pattern, replacement);
}

function updateJson(path, mutate) {
  updateFile(path, (source) => {
    const document = JSON.parse(source);
    const before = JSON.stringify(document);
    mutate(document);
    if (JSON.stringify(document) === before) return source;
    return `${JSON.stringify(document, null, 2)}\n`;
  });
}

updateFile("packages/sdk/jsr.json", (source) =>
  replaceExactly(source, /^(  "version": ")[^"]+(",)$/m, `$1${sdkVersion}$2`, "JSR version"),
);

updateFile("packages/sdk/.speakeasy/gen.yaml", (source) =>
  replaceExactly(
    source,
    /^(typescript:\n  version: )\S+$/m,
    `$1${sdkVersion}`,
    "Speakeasy TypeScript version",
  ),
);

updateFile("packages/sdk/src/lib/config.ts", (source) => {
  let updated = replaceExactly(
    source,
    /^(  sdkVersion: ")[^"]+(",)$/m,
    `$1${sdkVersion}$2`,
    "SDK runtime version",
  );
  updated = replaceExactly(
    updated,
    /^(  userAgent: "speakeasy-sdk\/typescript )[^\s"]+( .+",)$/m,
    `$1${sdkVersion}$2`,
    "SDK user-agent version",
  );
  return updated;
});

updateFile("packages/sdk/src/mcp-server/mcp-server.ts", (source) =>
  replaceExactly(
    source,
    /^(    currentVersion: ")[^"]+(",)$/m,
    `$1${sdkVersion}$2`,
    "MCP current version",
  ),
);

updateFile("packages/sdk/src/mcp-server/server.ts", (source) =>
  replaceExactly(source, /^(    version: ")[^"]+(",)$/m, `$1${sdkVersion}$2`, "MCP server version"),
);

updateJson("packages/sdk/package-lock.json", (document) => {
  document.version = sdkVersion;
  document.packages[""].version = sdkVersion;
});

updateJson("packages/sdk/examples/package-lock.json", (document) => {
  document.packages[".."].version = sdkVersion;
});

const outOfSync = [...updates.keys()];
if (checkOnly && outOfSync.length > 0) {
  throw new Error(
    `SDK version metadata does not match packages/sdk/package.json (${sdkVersion}):\n${outOfSync.map((path) => `- ${path}`).join("\n")}\nRun node scripts/sync-sdk-version.mjs to update it.`,
  );
}

if (!checkOnly && outOfSync.length > 0) {
  // Validate every generated file before writing: template changes must fail
  // without leaving an SDK with only some of its versions updated.
  for (const [path, contents] of updates) writeFileSync(path, contents);
  console.log(
    `Synchronized SDK version ${sdkVersion} in:\n${outOfSync.map((path) => `- ${path}`).join("\n")}`,
  );
}
