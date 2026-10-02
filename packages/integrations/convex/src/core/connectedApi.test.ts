import { describe, expect, it } from "vitest";
import { connectCreemApi, type CreemBillingModule } from "./connectedApi.js";

// Function references are opaque to `connectCreemApi`; distinct strings stand
// in for them.
const ref = <K extends keyof CreemBillingModule>(name: K) =>
  name as unknown as NonNullable<CreemBillingModule[K]>;

describe("connectCreemApi", () => {
  it("wires the billing email actions next to the portal", () => {
    const api = connectCreemApi({
      uiModel: ref("uiModel"),
      checkoutsCreate: ref("checkoutsCreate"),
      customersPortalUrl: ref("customersPortalUrl"),
      customersBillingEmail: ref("customersBillingEmail"),
      customersUpdateBillingEmail: ref("customersUpdateBillingEmail"),
    });

    expect(api.customers).toEqual({
      portalUrl: "customersPortalUrl",
      billingEmail: "customersBillingEmail",
      updateBillingEmail: "customersUpdateBillingEmail",
    });
  });

  it("omits the customers group when no customer export is present", () => {
    const api = connectCreemApi({
      uiModel: ref("uiModel"),
      checkoutsCreate: ref("checkoutsCreate"),
    });

    expect(api.customers).toBeUndefined();
  });
});
