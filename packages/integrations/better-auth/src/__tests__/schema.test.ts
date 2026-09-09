import { describe, expect, it } from "vitest";
import { getSchema } from "../schema.js";

describe("persistence schema", () => {
  it.each([undefined, true])(
    "registers customer and subscription fields when enabled (%s)",
    (persistSubscriptions) => {
      const schema = getSchema({ apiKey: "test", persistSubscriptions });
      expect(schema.user.fields.creemCustomerId.type).toBe("string");
      expect(schema.user.fields.hadTrial.type).toBe("boolean");
      expect(schema.creem_subscription.fields.referenceId.type).toBe("string");
    },
  );

  it("registers no models or user fields when persistence is disabled", () => {
    expect(getSchema({ apiKey: "test", persistSubscriptions: false })).toEqual({});
  });

  it("does not let name overrides register disabled models", () => {
    expect(
      getSchema({
        apiKey: "test",
        persistSubscriptions: false,
        schema: { user: { modelName: "accounts", fields: { creemCustomerId: "billing_id" } } },
      }),
    ).toEqual({});
  });

  it("maps physical names without changing other plugin instances", () => {
    const customized = getSchema({
      apiKey: "test",
      schema: {
        user: { modelName: "accounts", fields: { creemCustomerId: "billing_id" } },
        creem_subscription: {
          modelName: "billing_subscriptions",
          fields: { referenceId: "user_id" },
        },
      },
    });
    expect(customized.user).toMatchObject({
      modelName: "accounts",
      fields: { creemCustomerId: { fieldName: "billing_id", type: "string" } },
    });
    expect(customized.creem_subscription).toMatchObject({
      modelName: "billing_subscriptions",
      fields: { referenceId: { fieldName: "user_id", type: "string" } },
    });
    const defaults = getSchema({ apiKey: "test" });
    expect(defaults.user).not.toHaveProperty("modelName");
    expect(defaults.user.fields.creemCustomerId).not.toHaveProperty("fieldName");
    expect(defaults.creem_subscription).not.toHaveProperty("modelName");
    expect(defaults.creem_subscription.fields.referenceId).not.toHaveProperty("fieldName");
  });
});
