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
const resolve = (s: Schema | undefined): Schema | undefined => {
  while (s?.["$ref"]) s = schemas[s["$ref"].split("/").pop()];
  return s;
};
type Site = (string | number)[];

function sample(raw: Schema, path: Site, sites: Site[], key = "", depth = 0): unknown {
  const s = resolve(raw);
  if (!s) return null;
  if (s["allOf"]) {
    return Object.assign({}, ...s["allOf"].map((x: Schema) => sample(x, path, sites, key, depth)));
  }
  if (s["oneOf"] || s["anyOf"]) return sample((s["oneOf"] ?? s["anyOf"])[0], path, sites, key, depth);
  if (s["enum"]) {
    // `eventType` and `object` identify the variant and stay closed.
    if (key !== "eventType" && key !== "object") sites.push(path);
    return s["enum"][0];
  }
  if (s["type"] === "object" || s["properties"]) {
    if (depth > 6) return {};
    return Object.fromEntries(
      Object.entries<Schema>(s["properties"] ?? {}).map(([k, v]) => [k, sample(v, [...path, k], sites, k, depth + 1)]),
    );
  }
  if (s["type"] === "array") return [sample(s["items"], [...path, 0], sites, key, depth + 1)];
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
