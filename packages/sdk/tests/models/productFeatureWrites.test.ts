import { describe, expect, it } from "vitest";
import { UpdateProductRequestEntity$outboundSchema } from "../../src/models/components/updateproductrequestentity.js";

// ENG-2487: the live contract guards each edit variant of
// UpdateProductRequestEntity.features with `not: {deleted: true}`, which
// Speakeasy can't generate (it skipped products.update). The overlay
// .speakeasy/generator-compat.overlay.yaml drops the guard; these checks show
// the union still sends each entry as written. It also maps LicenseKeyFeature
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
