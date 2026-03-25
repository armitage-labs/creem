import { createCreem } from "../index";

export function hasCredentials(): boolean {
  return !!process.env.CREEM_TEST_API_KEY;
}

export const creem = createCreem({
  apiKey: process.env.CREEM_TEST_API_KEY || "",
  webhookSecret: process.env.CREEM_TEST_WEBHOOK_SECRET,
  testMode: true,
});

export const SUBSCRIPTION_PRODUCT_ID = process.env.CREEM_TEST_SUBSCRIPTION_PRODUCT_ID || "";
export const ONETIME_PRODUCT_ID = process.env.CREEM_TEST_ONETIME_PRODUCT_ID || "";
