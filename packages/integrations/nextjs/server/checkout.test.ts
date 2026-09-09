import type { CustomFieldRequestEntity } from "creem/models/components";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCheckout } = vi.hoisted(() => ({
  createCheckout: vi.fn(),
}));

vi.mock("creem", () => ({
  Creem: class {
    checkouts = { create: createCheckout };
  },
}));

import { Checkout } from "./checkout";

describe("Checkout", () => {
  beforeEach(() => {
    createCheckout.mockReset();
  });

  it("forwards SDK-compatible custom fields", async () => {
    const customFields: CustomFieldRequestEntity[] = [
      {
        type: "checkbox",
        key: "terms",
        label: "Accept the terms",
        optional: false,
      },
    ];
    const url = new URL("https://example.com/checkout");
    url.searchParams.set("productId", "prod_123");
    url.searchParams.set("requestId", "checkout_user-123_pro");
    url.searchParams.set("customFields", JSON.stringify(customFields));
    createCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.creem.io/session" });

    const response = await Checkout({ apiKey: "creem_test_123", testMode: true })(
      new NextRequest(url),
    );

    expect(response.status).toBe(307);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_123",
        requestId: "checkout_user-123_pro",
        customFields,
      }),
    );
  });
});
