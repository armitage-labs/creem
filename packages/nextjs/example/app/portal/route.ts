import { Portal } from "@creem_io/nextjs";

export const GET = Portal({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true, // Use test mode for sandbox - set to false for production
});
