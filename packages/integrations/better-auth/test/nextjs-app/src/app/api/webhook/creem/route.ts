import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook endpoint for Creem events
 *
 * Note: The Better-Auth plugin already handles webhooks at /api/auth/creem-webhook
 * This is just an example of how you could set up a custom webhook endpoint if needed.
 *
 * For production use, rely on the built-in webhook handler provided by the plugin.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("creem-signature");

    console.log("Webhook received:", {
      signature,
      body: body.substring(0, 100) + "...",
    });

    // The Better-Auth Creem plugin handles webhook verification and processing
    // This endpoint is just for demonstration purposes

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
