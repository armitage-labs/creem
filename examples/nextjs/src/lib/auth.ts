import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Database("auth.db"),
  logger: {
    level: "debug",
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
      testMode: process.env.CREEM_TEST_MODE === "true",
      persistSubscriptions: true,
      onGrantAccess: async (ctx) => {
        console.log("[creem] Access granted:", ctx.reason, ctx.customer.id);
      },
      onRevokeAccess: async (ctx) => {
        console.log("[creem] Access revoked:", ctx.reason, ctx.customer.id);
      },
    }),
  ],
});
