import { describe, it, expect } from "vitest";
import * as errors from "creem/models/errors";
import { fakeCreem, productGroupJson, productJson } from "./migrate-fixtures";

/**
 * The in-memory Creem behind the migrate tests answers as the API documents
 * (ENG-2228/2229 products, ENG-2277 discounts, ENG-2276 product groups,
 * ENG-2494 validate), through the real SDK.
 */
describe("fakeCreem models the catalog API", () => {
  const product = {
    name: "Pro",
    description: "Pro plan",
    price: 1000,
    currency: "EUR",
    billingType: "onetime",
    externalId: "pro",
  } as const;

  it("upserts a product by external_id: created, unchanged, updated", async () => {
    const creem = fakeCreem();
    const created = await creem.client.products.create({ createProductRequestEntity: product });
    expect(created.writeResult).toMatchObject({ result: "created", dryRun: false });
    const again = await creem.client.products.create({ createProductRequestEntity: product });
    expect(again.id).toBe(created.id);
    expect(again.writeResult).toMatchObject({ result: "unchanged", changes: [] });
    const renamed = await creem.client.products.create({
      createProductRequestEntity: { externalId: "pro", name: "Pro 2" },
    });
    expect(renamed.writeResult.result).toBe("updated");
    expect(renamed.writeResult.changes).toEqual([{ path: "name", from: "Pro", to: "Pro 2" }]);
    expect(creem.state.products).toHaveLength(1);
  });

  it("runs a dry run and writes nothing, with write_result.dry_run true", async () => {
    const creem = fakeCreem();
    const preview = await creem.client.products.create({
      createProductRequestEntity: product,
      dryRun: true,
    });
    expect(preview.writeResult).toMatchObject({ result: "created", dryRun: true });
    expect(creem.state.products).toEqual([]);
    expect(creem.dryRuns()).toHaveLength(1);
    expect(creem.writes()).toEqual([]);
    // Ids a dry run would create are never stored, so the real create gets the first id.
    const real = await creem.client.products.create({ createProductRequestEntity: product });
    expect(real.id).toBe(preview.id);
  });

  it("answers 412 to If-None-Match: * when the key is held, and 400 to a keyed create without its fields", async () => {
    const creem = fakeCreem({ products: [productJson("prod_a", { external_id: "pro" })] });
    await expect(
      creem.client.products.create({ createProductRequestEntity: product, ifNoneMatch: "*" }),
    ).rejects.toMatchObject({ statusCode: 412 });
    await expect(
      creem.client.products.create({
        createProductRequestEntity: { externalId: "new", name: "X" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("ignores a different tax_category on an upsert with a field_not_writable warning", async () => {
    const creem = fakeCreem({ products: [productJson("prod_a", { external_id: "pro" })] });
    const answer = await creem.client.products.create({
      createProductRequestEntity: { externalId: "pro", taxCategory: "ebooks" },
    });
    expect(answer.writeResult.result).toBe("unchanged");
    expect(answer.writeResult.warnings).toEqual([
      expect.objectContaining({ code: "field_not_writable", path: "tax_category" }),
    ]);
  });

  it("upserts a discount by external_id, refuses a new key whose code is taken, and warns about unknown product keys in a dry run", async () => {
    const creem = fakeCreem({ products: [productJson("prod_a", { external_id: "pro" })] });
    const body = {
      name: "Launch",
      code: "LAUNCH",
      type: "percentage",
      percentage: 10,
      duration: "forever",
      externalId: "launch",
      appliesToProductExternalIds: ["pro"],
    } as const;
    const created = await creem.client.discounts.create({ createDiscountRequestEntity: body });
    expect(created.writeResult.result).toBe("created");
    const again = await creem.client.discounts.create({ createDiscountRequestEntity: body });
    expect(again.writeResult.result).toBe("unchanged");
    await expect(
      creem.client.discounts.create({
        createDiscountRequestEntity: { ...body, externalId: "other", code: "launch" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const preview = await creem.client.discounts.create({
      createDiscountRequestEntity: { ...body, appliesToProductExternalIds: ["pro", "later"] },
      dryRun: true,
    });
    expect(preview.writeResult.warnings).toEqual([
      { code: "reference_not_found", path: "applies_to_product_external_ids", key: "later" },
    ]);
    await expect(
      creem.client.discounts.create({
        createDiscountRequestEntity: { ...body, appliesToProductExternalIds: ["pro", "later"] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("upserts a product group: 201 on create, 200 unchanged, 409 for a product in another group", async () => {
    const creem = fakeCreem({
      products: [
        productJson("prod_a", { external_id: "a" }),
        productJson("prod_b", { external_id: "b" }),
        productJson("prod_c", { external_id: "c" }),
      ],
      productGroups: [
        productGroupJson("pgrp_x", { products: [{ id: "prod_c", external_id: "c" }] }),
      ],
    });
    const body = {
      name: "Plans",
      externalId: "plans",
      products: [{ externalId: "a" }, { externalId: "b" }],
    };
    const created = await creem.client.productGroups.create({
      createProductGroupRequestEntity: body,
    });
    expect(created.writeResult.result).toBe("created");
    expect(created.products.map((p) => p.externalId)).toEqual(["a", "b"]);
    const again = await creem.client.productGroups.create({
      createProductGroupRequestEntity: body,
    });
    expect(again.writeResult.result).toBe("unchanged");
    await expect(
      creem.client.productGroups.create({
        createProductGroupRequestEntity: { ...body, products: [{ externalId: "c" }] },
        dryRun: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("validates a batch of products in one rolled-back run: 200 with dry-run answers, 422 with each failing item's error", async () => {
    const creem = fakeCreem({ products: [productJson("prod_a", { external_id: "taken" })] });
    const ok = await creem.client.catalog.validate({
      items: [
        {
          kind: "product",
          body: {
            name: "Pro",
            description: "Pro",
            price: 1000,
            currency: "EUR",
            billing_type: "onetime",
            external_id: "pro",
          },
        },
        // Sees the product the item before it would create.
        { kind: "product", body: { external_id: "pro", name: "Pro 2" } },
      ],
    });
    expect(ok.valid).toBe(true);
    expect(ok.items.map((i) => i.response?.write_result)).toEqual([
      expect.objectContaining({ result: "created", dry_run: true }),
      expect.objectContaining({ result: "updated", dry_run: true }),
    ]);
    expect(creem.state.products).toHaveLength(1);
    const refused = await creem.client.catalog
      .validate({
        items: [
          { kind: "product", id: "prod_missing", body: { external_id: "x" } },
          { kind: "product", body: { external_id: "y", name: "Y" } },
        ],
      })
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(errors.CatalogValidationResponseDto);
    const failed = refused as errors.CatalogValidationResponseDto;
    expect(failed.valid).toBe(false);
    expect(failed.items.map((i) => [i.valid, i.status, i.error?.code])).toEqual([
      [false, 404, "not_found"],
      [false, 400, "validation_error"],
    ]);
  });

  it("refuses to validate discounts and product groups, and batches over 100 items", async () => {
    const creem = fakeCreem();
    await expect(
      creem.client.catalog.validate({ items: [{ kind: "discount", body: {} }] }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      creem.client.catalog.validate({
        items: Array.from({ length: 101 }, () => ({ kind: "product", body: {} })),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("models a server that ignores dry_run: it writes and answers dry_run false", async () => {
    const creem = fakeCreem({}, { ignoreDryRun: true });
    const answer = await creem.client.products.create({
      createProductRequestEntity: product,
      dryRun: true,
    });
    expect(answer.writeResult.dryRun).toBe(false);
    expect(creem.state.products).toHaveLength(1);
  });
});
