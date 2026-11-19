import { describe, expect, it } from "vitest";
import { FileEntity$inboundSchema } from "../../src/models/components/fileentity.js";
import { ProductEntity$inboundSchema } from "../../src/models/components/productentity.js";

// ENG-2487: response enums are open, so a value the API adds later reaches
// callers as a string instead of failing the whole response.
const product = {
  id: "prod_test",
  mode: "test",
  object: "product",
  name: "Monthly subscription",
  description: "A recurring product",
  price: 1000,
  currency: "EUR",
  billing_type: "recurring",
  billing_period: "every-month",
  status: "active",
  tax_mode: "inclusive",
  tax_category: "saas",
  external_id: null,
  metadata: null,
  created_at: "2026-09-05T09:33:00.965Z",
  updated_at: "2026-09-05T09:33:00.965Z",
};

describe("forward-compatible response enums", () => {
  it("keeps a status value the SDK doesn't know yet", () => {
    const parsed = ProductEntity$inboundSchema.parse({ ...product, status: "paused_by_review" });

    expect(parsed.status).toBe("paused_by_review");
  });

  it("still returns the known values as before", () => {
    expect(ProductEntity$inboundSchema.parse(product).status).toBe("active");
  });
});

// A single-value enum is not opened by the generator default; the overlay
// opens FileEntity.purpose so a purpose Creem adds later still parses.
describe("forward-compatible file purpose", () => {
  const file = {
    id: "file_4dGTkmBdnTnU9vV3KZ2Hcz",
    object: "file",
    purpose: "product_file",
    filename: "ebook.epub",
    content_type: "application/epub+zip",
    size: 52000,
    sha256: null,
    created_at: "2026-11-17T10:05:00.000Z",
  };

  it("keeps a purpose the SDK doesn't know yet", () => {
    const parsed = FileEntity$inboundSchema.parse({ ...file, purpose: "product_image" });

    expect(parsed.purpose).toBe("product_image");
  });

  it("still returns product_file as before", () => {
    expect(FileEntity$inboundSchema.parse(file).purpose).toBe("product_file");
  });
});
