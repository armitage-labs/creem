import { NextRequest, NextResponse } from "next/server";
import { Creem } from "creem";

interface PortalRouteInstance {
  apiKey: string;
  testMode?: boolean;
}

export const Portal = ({ apiKey, testMode = false }: PortalRouteInstance) => {
  // serverIdx: 0 = production, 1 = test
  const creem = new Creem({
    apiKey,
    serverIdx: testMode ? 1 : 0,
  });

  return async (req: NextRequest) => {
    const customerId = req.nextUrl.searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    try {
      const portal = await creem.customers.generateBillingLinks({
        customerId,
      });

      // Redirect to the portal URL
      if (!portal.customerPortalLink) {
        return NextResponse.json(
          { error: "Portal URL not available" },
          { status: 500 }
        );
      }

      return NextResponse.redirect(portal.customerPortalLink);
    } catch (error) {
      console.error("Portal creation failed:", error);

      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";

      return NextResponse.json(
        {
          error: "Failed to create portal",
          details: errorMessage,
        },
        { status: 500 }
      );
    }
  };
};
