import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWebhookEventEntity } from "../../src/webhooks.js";

// Every enum in every webhook payload, taken from the OpenAPI document, must
// accept a value Creem adds later. The overlay opens the webhook-only enums by
// hand; this fails, naming the field, when a spec sync adds one it doesn't
// list or moves one of its targets.
type Schema = Record<string, any>;
const spec = JSON.parse(
  readFileSync(new URL("../../openapi.json", import.meta.url), "utf8"),
);
const schemas: Record<string, Schema> = spec.components.schemas;
const refName = (s: Schema): string => s["$ref"].split("/").pop();
const resolve = (s: Schema | undefined): Schema | undefined => {
  while (s?.["$ref"]) s = schemas[refName(s)];
  return s;
};
type Site = (string | number)[];

/**
 * Builds a payload from the schema and records the path of every enum in it.
 * At a `oneOf`, the branch with properties is followed, so an expandable field
 * (`customer`, `product`, …) is swept as its nested entity, not as its id. A
 * schema already on the current path is a cycle and stops there.
 */
function sample(raw: Schema, path: Site, sites: Site[], key = "", seen: ReadonlySet<string> = new Set()): unknown {
  let s: Schema | undefined = raw;
  let onPath: ReadonlySet<string> = seen;
  while (s?.["$ref"]) {
    const name = refName(s);
    if (onPath.has(name)) return {};
    onPath = new Set([...onPath, name]);
    s = schemas[name];
  }
  if (!s) return null;
  if (s["allOf"]) {
    return Object.assign({}, ...s["allOf"].map((x: Schema) => sample(x, path, sites, key, onPath)));
  }
  if (s["oneOf"] || s["anyOf"]) {
    const branches: Schema[] = s["oneOf"] ?? s["anyOf"];
    const withProperties = branches.find((branch) => {
      let b: Schema | undefined = branch;
      while (b?.["$ref"]) b = schemas[refName(b)];
      return b?.["properties"] !== undefined || b?.["allOf"] !== undefined;
    });
    return sample(withProperties ?? branches[0]!, path, sites, key, onPath);
  }
  if (s["enum"]) {
    // `eventType` and `object` identify the variant and stay closed.
    if (key !== "eventType" && key !== "object") sites.push(path);
    return s["enum"][0];
  }
  if (s["type"] === "object" || s["properties"]) {
    return Object.fromEntries(
      Object.entries<Schema>(s["properties"] ?? {}).map(([k, v]) => [k, sample(v, [...path, k], sites, k, onPath)]),
    );
  }
  if (s["type"] === "array") return [sample(s["items"], [...path, 0], sites, key, onPath)];
  if (s["type"] === "string") {
    if (s["format"] === "date-time") return "2026-01-01T00:00:00.000Z";
    return typeof s["example"] === "string" ? s["example"] : "x";
  }
  if (s["type"] === "integer" || s["type"] === "number") return typeof s["example"] === "number" ? s["example"] : 1;
  if (s["type"] === "boolean") return true;
  return s["example"] ?? null;
}

describe("forward-compatible webhook payloads, every enum", () => {
  const variants: string[] = resolve(schemas["WebhookEventEntity"])!["oneOf"].map(
    (r: Schema) => r["$ref"].split("/").pop(),
  );

  it.each(variants)("%s accepts a new value in each of its enums", (variant) => {
    const sites: Site[] = [];
    const payload = sample(schemas[variant]!, [], sites) as Record<string, any>;
    expect(parseWebhookEventEntity(JSON.stringify(payload)).eventType).toBe(payload["eventType"]);

    const refused: string[] = [];
    for (const site of sites) {
      const mutated = structuredClone(payload);
      let target: any = mutated;
      for (const k of site.slice(0, -1)) target = target[k];
      target[site[site.length - 1]!] = "value_added_later";
      try {
        parseWebhookEventEntity(JSON.stringify(mutated));
      } catch {
        refused.push(site.join("."));
      }
    }
    expect(refused).toEqual([]);
  });
});
