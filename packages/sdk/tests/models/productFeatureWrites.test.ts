import { describe, expect, it } from "vitest";
import {
  UpdateProductRequestEntity$inboundSchema,
  UpdateProductRequestEntity$outboundSchema,
} from "../../src/models/components/updateproductrequestentity.js";

// ENG-2487: the live contract guards each edit variant of
// UpdateProductRequestEntity.features with `not: {deleted: true}`, which
// Speakeasy can't generate (it skipped products.update). The overlay
// .speakeasy/generator-compat.overlay.yaml replaces the guard with
// `deleted?: false` on each edit variant; these checks show the union still
// sends and reads each entry as the API takes it. It also maps LicenseKeyFeature
// expiry to `LicenseKeyExpiryEntity | null` instead of an empty-object branch.
describe("product feature writes", () => {
  it("sends a deletion entry with deleted: true and nothing it doesn't name", () => {
    const body = UpdateProductRequestEntity$outboundSchema.parse({
      features: [{ externalId: "welcome-note", type: "custom", deleted: true }],
    });

    expect(body.features).toEqual([{ external_id: "welcome-note", type: "custom", deleted: true }]);
  });

  it("sends an edit entry next to a deletion, each as its own variant", () => {
    const body = UpdateProductRequestEntity$outboundSchema.parse({
      features: [
        {
          id: "feat_note",
          type: "custom",
          description: "Welcome note",
          privateNote: "Thanks for buying",
        },
        { id: "feat_old", deleted: true },
      ],
    });

    expect(body.features).toEqual([
      {
        id: "feat_note",
        type: "custom",
        description: "Welcome note",
        private_note: "Thanks for buying",
      },
      { id: "feat_old", deleted: true },
    ]);
  });

  // The API reads any entry with `deleted: true` as a deletion, even one that
  // also carries edit fields (a feature read back and marked deleted). Sent as
  // an edit instead, it would keep the feature and, under the per-type
  // replacement, remove its siblings.
  it("sends an entry with deleted: true as a deletion, whatever else it carries", () => {
    const body = UpdateProductRequestEntity$outboundSchema.parse({
      features: [
        {
          id: "feat_note",
          type: "custom",
          description: "Welcome note",
          privateNote: "Thanks for buying",
          deleted: true,
        },
        {
          id: "feat_key",
          type: "licenseKey",
          description: "License key",
          licenseKey: { activationLimit: 3, expiry: null },
          deleted: true,
        },
        {
          externalId: "ebook",
          type: "file",
          description: "E-book",
          file: { files: [{ id: "file_abc" }] },
          deleted: true,
        },
        {
          id: "feat_credits",
          type: "customerCredits",
          description: "Credits",
          customerCredits: { amount: "100" },
          deleted: true,
        },
      ],
    });

    expect(body.features).toEqual([
      { id: "feat_note", type: "custom", deleted: true },
      { id: "feat_key", type: "licenseKey", deleted: true },
      { external_id: "ebook", type: "file", deleted: true },
      { id: "feat_credits", type: "customerCredits", deleted: true },
    ]);
  });

  it("sends an entry with deleted: false as an edit", () => {
    const body = UpdateProductRequestEntity$outboundSchema.parse({
      features: [
        {
          id: "feat_note",
          type: "custom",
          description: "Welcome note",
          privateNote: "Thanks for buying",
          deleted: false,
        },
      ],
    });

    expect(body.features).toEqual([
      {
        id: "feat_note",
        type: "custom",
        description: "Welcome note",
        private_note: "Thanks for buying",
        deleted: false,
      },
    ]);
  });

  it("reads an entry with deleted: true as a deletion, whatever else it carries", () => {
    const request = UpdateProductRequestEntity$inboundSchema.parse({
      features: [
        {
          id: "feat_note",
          type: "custom",
          description: "Welcome note",
          private_note: "Thanks for buying",
          deleted: true,
        },
        {
          id: "feat_note_2",
          type: "custom",
          description: "Second note",
          private_note: "Kept",
        },
      ],
    });

    expect(request.features).toEqual([
      { id: "feat_note", type: "custom", deleted: true },
      { id: "feat_note_2", type: "custom", description: "Second note", privateNote: "Kept" },
    ]);
  });

  it("sends a license key that never expires as expiry: null", () => {
    const body = UpdateProductRequestEntity$outboundSchema.parse({
      features: [
        {
          type: "licenseKey",
          description: "License key",
          licenseKey: { activationLimit: 3, expiry: null },
        },
      ],
    });

    expect(body.features).toEqual([
      {
        type: "licenseKey",
        description: "License key",
        license_key: { activation_limit: 3, expiry: null },
      },
    ]);
  });

  it("sends a license key expiry as interval and interval_count", () => {
    const body = UpdateProductRequestEntity$outboundSchema.parse({
      features: [
        {
          type: "licenseKey",
          description: "License key",
          licenseKey: { activationLimit: null, expiry: { interval: "year", intervalCount: 1 } },
        },
      ],
    });

    expect(body.features?.[0]).toMatchObject({
      license_key: { activation_limit: null, expiry: { interval: "year", interval_count: 1 } },
    });
  });
});
