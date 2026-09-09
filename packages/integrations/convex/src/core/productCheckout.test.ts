import { describe, expect, it } from "vitest";
import {
  getActiveOwnedProductId,
  getEffectiveOwnedProductIds,
  isOwnedProduct,
  resolveProductCheckoutProductId,
  shouldSuppressPendingCheckout,
} from "./productCheckout.js";

describe("product checkout helpers", () => {
  const oneTime = { productId: "prod_lifetime", type: "one-time" as const };
  const repeatable = { productId: "prod_credits", type: "recurring" as const };

  it("does not treat repeatable products as owned entitlements", () => {
    const owned = ["prod_credits"];

    expect(isOwnedProduct(repeatable, owned)).toBe(false);
    expect(getActiveOwnedProductId([repeatable], owned)).toBeNull();
    expect(
      shouldSuppressPendingCheckout("prod_credits", [repeatable], owned),
    ).toBe(false);
  });

  it("keeps repeatable products checkoutable even when already purchased", () => {
    expect(
      resolveProductCheckoutProductId(repeatable, "prod_lifetime", []),
    ).toBe("prod_credits");
  });

  it("keeps one-time ownership and upgrade transitions intact", () => {
    const premium = { productId: "prod_premium", type: "one-time" as const };
    const transitions = [
      {
        from: "prod_lifetime",
        to: "prod_premium",
        kind: "via_product" as const,
        viaProductId: "prod_upgrade_delta",
      },
    ];

    expect(isOwnedProduct(oneTime, ["prod_lifetime"])).toBe(true);
    expect(getActiveOwnedProductId([oneTime, premium], ["prod_lifetime"])).toBe(
      "prod_lifetime",
    );
    expect(
      resolveProductCheckoutProductId(premium, "prod_lifetime", transitions),
    ).toBe("prod_upgrade_delta");
    expect(
      shouldSuppressPendingCheckout(
        "prod_lifetime",
        [oneTime],
        ["prod_lifetime"],
      ),
    ).toBe(true);
  });

  it("maps via-product ownership to the transition target", () => {
    expect(
      getEffectiveOwnedProductIds(
        ["prod_upgrade_delta"],
        [
          {
            from: "prod_basic",
            to: "prod_premium",
            kind: "via_product",
            viaProductId: "prod_upgrade_delta",
          },
        ],
      ),
    ).toEqual(["prod_upgrade_delta", "prod_premium"]);
  });
});

describe("shouldSuppressPendingCheckout ownership requires item type", () => {
  it("does not suppress on raw ownership alone", () => {
    // Tempting shortcut: fall back to `effectiveOwnedProductIds` when items
    // have not registered yet. It is wrong — repeatable products are in that
    // list too, and suppressing them would block a legitimate re-purchase.
    expect(
      shouldSuppressPendingCheckout("prod_owned", [], ["prod_owned"]),
    ).toBe(false);
  });
});
