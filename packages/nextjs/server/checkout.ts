import { NextRequest, NextResponse } from "next/server";
import { Creem } from "creem";
import { resolveSuccessUrl } from "./utils";

interface CheckoutRouteInstance {
  apiKey: string;
  testMode?: boolean;
  defaultSuccessUrl?: string;
}

export const Checkout = ({
  apiKey,
  testMode = false,
  defaultSuccessUrl,
}: CheckoutRouteInstance) => {
  // serverIdx: 0 = production, 1 = test
  const creem = new Creem({
    apiKey,
    serverIdx: testMode ? 1 : 0,
  });

  return async (req: NextRequest) => {
    const productId = req.nextUrl.searchParams.get("productId");
    const unitsParam = req.nextUrl.searchParams.get("units");
    const discountCode = req.nextUrl.searchParams.get("discountCode");
    const customerParam = req.nextUrl.searchParams.get("customer");
    const customFieldsParam = req.nextUrl.searchParams.get("customFields");
    const successUrl = resolveSuccessUrl(
      req.nextUrl.searchParams.get("successUrl") ?? defaultSuccessUrl,
      req
    );
    const metadataParam = req.nextUrl.searchParams.get("metadata");
    const referenceId = req.nextUrl.searchParams.get("referenceId");

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    // Parse units to number
    const units = unitsParam ? parseInt(unitsParam, 10) : undefined;

    // Parse customer JSON if provided
    let customer;
    try {
      customer = customerParam ? JSON.parse(customerParam) : undefined;
    } catch {
      return NextResponse.json(
        { error: "Invalid customer JSON" },
        { status: 400 }
      );
    }

    // Parse metadata JSON if provided
    let metadata;
    try {
      metadata = metadataParam ? JSON.parse(metadataParam) : undefined;
    } catch {
      return NextResponse.json(
        { error: "Invalid metadata JSON" },
        { status: 400 }
      );
    }

    // Parse customFields JSON if provided
    let customFields;
    try {
      customFields = customFieldsParam ? JSON.parse(customFieldsParam) : undefined;
    } catch {
      return NextResponse.json(
        { error: "Invalid customFields JSON" },
        { status: 400 }
      );
    }

    try {
      const checkout = await creem.checkouts.create({
        productId,
        units,
        discountCode: discountCode ?? undefined,
        ...(customer && { customer }),
        ...(customFields && { customFields }),
        successUrl,
        metadata: {
          ...(metadata || {}),
          ...(referenceId && { referenceId }),
        },
      });

      // Redirect to the checkout URL
      if (!checkout.checkoutUrl) {
        return NextResponse.json(
          { error: "Checkout URL not available" },
          { status: 500 }
        );
      }

      return NextResponse.redirect(checkout.checkoutUrl);
    } catch (error) {
      console.error("Checkout creation failed:", error);

      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      return NextResponse.json(
        {
          error: "Failed to create checkout",
          details: errorMessage,
        },
        { status: 500 }
      );
    }
  };
};
