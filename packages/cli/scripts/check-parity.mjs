import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const camel = (s) =>
  s[0].toLowerCase() + s.slice(1).replace(/[-_]([a-zA-Z])/g, (_, c) => c.toUpperCase());
export function normalizeSchema(schema, spec) {
  if (schema.$ref)
    schema = {
      ...spec.components.schemas[schema.$ref.split("/").at(-1)],
      ...Object.fromEntries(Object.entries(schema).filter(([k]) => k !== "$ref")),
    };
  for (const child of schema.allOf ?? []) schema = { ...schema, ...normalizeSchema(child, spec) };
  const out = Object.fromEntries(
    Object.entries(schema).filter(([k]) =>
      ["type", "enum", "format", "minimum", "maximum", "nullable", "additionalProperties"].includes(
        k,
      ),
    ),
  );
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [camel(k), normalizeSchema(v, spec)]),
    );
    out.required = (schema.required ?? []).map(camel);
  }
  if (schema.items) out.items = normalizeSchema(schema.items, spec);
  return out;
}
export function checkParity({
  spec,
  manifest,
  program,
  sdkMethods,
  handlerSources,
  strict = true,
  docs,
} = {}) {
  spec ??= JSON.parse(readFileSync(resolve(root, "../sdk/openapi.json"), "utf8"));
  manifest ??= JSON.parse(readFileSync(resolve(root, "src/operation-manifest.json"), "utf8"));
  program ??= require("../dist/program.js").createProgram();
  const methods =
    sdkMethods ??
    readdirSync(resolve(root, "../sdk/src/sdk"))
      .filter((f) => f.endsWith(".ts"))
      .flatMap((file) => {
        const group = file === "customercredits.ts" ? "customerCredits" : file.replace(".ts", "");
        return [
          ...readFileSync(resolve(root, "../sdk/src/sdk", file), "utf8").matchAll(
            /\basync (\w+)\(/g,
          ),
        ].map((m) => `${group}.${m[1]}`);
      });
  const sources =
    handlerSources ??
    readdirSync(resolve(root, "src/commands/operations"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(resolve(root, "src/commands/operations", f), "utf8"))
      .join("\n");
  const operations = Object.values(spec.paths).flatMap((path) =>
    Object.values(path).filter((op) => op && typeof op === "object" && op.operationId),
  );
  assert.equal(
    new Set(manifest.map((r) => r.operationId)).size,
    manifest.length,
    "Duplicate operation mapping",
  );
  assert.equal(
    new Set(manifest.map((r) => r.sdkMethod)).size,
    manifest.length,
    "Duplicate SDK mapping",
  );
  assert.equal(
    new Set(manifest.map((r) => r.cliPath)).size,
    manifest.length,
    "Duplicate CLI mapping",
  );
  assert.deepEqual(
    manifest.map((r) => r.operationId).sort(),
    operations.map((o) => o.operationId).sort(),
    "OpenAPI/manifest operation drift",
  );
  assert.deepEqual(
    manifest.map((r) => r.sdkMethod).sort(),
    methods.sort(),
    "SDK/manifest method drift",
  );
  for (const row of manifest) {
    assert.equal(
      row.disposition,
      "implemented",
      `${row.operationId}: ${strict ? "strict parity requires implementation" : "no exclusions or planned operations are authorized for this baseline"}`,
    );
    const op = operations.find((o) => o.operationId === row.operationId);
    assert.deepEqual(
      row.parameters.map((p) => `${p.in}:${p.name}`).sort(),
      (op.parameters ?? []).map((p) => `${p.in}:${p.name}`).sort(),
      `${row.operationId}: parameter drift`,
    );
    let cmd = program;
    for (const part of row.cliPath.split(" ")) {
      cmd = cmd.commands.find((c) => c.name() === part);
      assert.ok(cmd, `Missing CLI path: ${row.cliPath}`);
    }
    assert.ok(cmd._actionHandler, `No action: ${row.cliPath}`);
    const handler = sources.match(
      new RegExp(`${row.operationId}: ([\\s\\S]*?)(?=\\n  \\w+:|\\n};)`),
    )?.[1];
    assert.ok(handler, `${row.operationId}: missing SDK handler`);
    const calls = [...handler.matchAll(/return client\.(\w+\.\w+)\(/g)].map((match) => match[1]);
    assert.deepEqual(calls, [row.sdkMethod], `${row.operationId}: incorrect SDK handler`);
    assert.equal(
      new Set(row.parameters.map((p) => p.cliFlagOrArgument)).size,
      row.parameters.length,
      `${row.operationId}: duplicate CLI parameter mapping`,
    );
    for (const p of row.parameters) {
      const param = op.parameters.find((v) => v.in === p.in && v.name === p.name);
      assert.equal(p.sdkName, camel(p.name), `${row.operationId}: parameter SDK name`);
      assert.equal(p.required, !!param.required, `${row.operationId}: parameter required`);
      assert.deepEqual(
        p.schema,
        normalizeSchema(param.schema, spec),
        `${row.operationId}: parameter schema drift`,
      );
      assert.ok(
        p.cliFlagOrArgument.startsWith("--")
          ? cmd.options.some((o) => o.long === p.cliFlagOrArgument)
          : cmd.registeredArguments.length,
        `${row.operationId}: unmapped input ${p.name}`,
      );
    }
    const body = op.requestBody?.content?.["application/json"]?.schema;
    assert.equal(!!row.body, !!body, `${row.operationId}: body drift`);
    if (body) {
      assert.ok(
        row.body.viaData && cmd.options.some((o) => o.long === "--data"),
        `${row.operationId}: missing --data`,
      );
      assert.deepEqual(
        row.body.schema,
        normalizeSchema(body, spec),
        `${row.operationId}: request-body schema drift`,
      );
      for (const flag of Object.values(row.body.primaryFlags))
        assert.ok(
          cmd.options.some((o) => o.long === flag),
          `${row.operationId}: missing body flag ${flag}`,
        );
    }
    if (row.pagination !== "none")
      assert.ok(
        cmd.options.some((o) => o.long === "--all"),
        `${row.operationId}: missing --all`,
      );
  }
  if (docs)
    for (const row of manifest)
      assert.ok(
        docs.includes("`creem " + row.cliPath + "`"),
        `Documentation missing ${row.cliPath}`,
      );
  return { operations: operations.length, implemented: manifest.length };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(
    readFileSync(resolve(root, "../sdk/openapi.json"), "utf8"),
    readFileSync(resolve(root, "../docs/api-reference/openapi.json"), "utf8"),
    "SDK/docs OpenAPI drift",
  );
  const report = checkParity({
    strict: process.argv.includes("--strict"),
    docs: readFileSync(resolve(root, "README.md"), "utf8"),
  });
  console.log(
    `CLI parity: ${report.implemented}/${report.operations} operations (100%); all parameters, request bodies, handlers and documented commands covered.`,
  );
}
