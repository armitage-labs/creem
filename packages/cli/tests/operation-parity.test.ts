import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createProgram } from "../src/program";
import { operationManifest } from "../src/operation-manifest";
import { checkParity } from "../scripts/check-parity.mjs";
const spec = JSON.parse(readFileSync("../sdk/openapi.json", "utf8"));
it("strictly covers the complete SDK and current contract", () =>
  expect(checkParity({ program: createProgram() })).toEqual({ operations: 55, implemented: 55 }));
it.each(["operation", "parameter", "body", "duplicate", "path", "planned"])(
  "detects %s drift",
  (kind) => {
    const manifest = structuredClone(operationManifest);
    const changed = structuredClone(spec);
    if (kind === "operation") manifest.pop();
    if (kind === "parameter")
      changed.paths["/v1/products/search"].get.parameters.push({
        name: "new_input",
        in: "query",
        schema: { type: "string" },
      });
    if (kind === "body")
      changed.components.schemas.CreateProductRequestEntity.properties.new_field = {
        type: "string",
      };
    if (kind === "duplicate") manifest.push(manifest[0]);
    if (kind === "path") manifest[0].cliPath = "products absent";
    if (kind === "planned") manifest[0].disposition = "planned";
    expect(() => checkParity({ manifest, spec: changed, program: createProgram() })).toThrow();
  },
);
