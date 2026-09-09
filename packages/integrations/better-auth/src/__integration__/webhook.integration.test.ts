import { describe, it, expect } from "vitest";
import { getTestConfig, hasCredentials } from "./setup.js";
import { generateSignature } from "../utils.js";
import { validateWebhookSignature } from "../creem-server.js";

describe.skipIf(!hasCredentials())("Webhook signature integration", () => {
  const config = getTestConfig();

  it.skipIf(!config.webhookSecret)(
    "generates a signature with the real webhook secret",
    async () => {
      const payload = JSON.stringify({
        eventType: "checkout.completed",
        id: "test_evt",
        created_at: Date.now() / 1000,
      });

      const signature = await generateSignature(payload, config.webhookSecret);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature).toMatch(/^[0-9a-f]+$/);
    },
  );

  it.skipIf(!config.webhookSecret)("round-trip: sign and verify", async () => {
    const payload = JSON.stringify({
      eventType: "subscription.active",
      id: "test_evt_2",
      created_at: Date.now() / 1000,
      object: {
        id: "sub_test",
        object: "subscription",
        status: "active",
      },
    });

    const signature = await generateSignature(payload, config.webhookSecret);
    const isValid = await validateWebhookSignature(payload, signature, config.webhookSecret);
    expect(isValid).toBe(true);
  });

  it.skipIf(!config.webhookSecret)("rejects tampered payload", async () => {
    const payload = '{"test":"original"}';
    const signature = await generateSignature(payload, config.webhookSecret);
    const isValid = await validateWebhookSignature(
      '{"test":"tampered"}',
      signature,
      config.webhookSecret,
    );
    expect(isValid).toBe(false);
  });
});
