import { Checkout } from "@creem_io/nextjs";

export const GET = Checkout({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true,
});
