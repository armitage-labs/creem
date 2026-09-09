import type { ReactElement } from "react";
import type { CustomFieldRequestEntity } from "creem/models/components";
import { describe, expect, it } from "vitest";
import { CreemCheckout } from "./client";

describe("CreemCheckout", () => {
  it("serializes SDK-compatible custom fields", () => {
    const customFields: CustomFieldRequestEntity[] = [
      {
        type: "text",
        key: "company",
        label: "Company name",
        optional: true,
        text: { minLength: 2, maxLength: 100 },
      },
    ];

    const element = CreemCheckout({
      productId: "prod_123",
      requestId: "checkout_user-123_pro",
      customFields,
      children: "Subscribe",
    }) as ReactElement<{ href: string }>;
    const url = new URL(element.props.href, "https://example.com");

    expect(JSON.parse(url.searchParams.get("customFields")!)).toEqual(customFields);
    expect(url.searchParams.get("requestId")).toBe("checkout_user-123_pro");
  });
});
