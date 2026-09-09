import { betterAuth } from "better-auth";
import type BetterSqlite3 from "better-sqlite3";
import Database from "better-sqlite3";
import { creem } from "../index.js";
import { Creem } from "creem";

const apiKey = process.env.CREEM_TEST_API_KEY || "";
const webhookSecret = process.env.CREEM_TEST_WEBHOOK_SECRET || "";

export function getTestConfig() {
  return {
    apiKey,
    webhookSecret,
    productId: process.env.CREEM_TEST_PRODUCT_ID || "",
    productIdOnetime: process.env.CREEM_TEST_PRODUCT_ID_ONETIME || "",
    customerId: process.env.CREEM_TEST_CUSTOMER_ID || "",
    subscriptionId: process.env.CREEM_TEST_SUBSCRIPTION_ID || "",
  };
}

export function hasCredentials(): boolean {
  return !!apiKey;
}

export function createTestCreemClient(): Creem {
  return new Creem({
    apiKey,
    serverURL: "https://test-api.creem.io",
  });
}

export function createTestAuth(): {
  auth: ReturnType<typeof betterAuth>;
  db: BetterSqlite3.Database;
} {
  const db = new Database(":memory:");

  const auth = betterAuth({
    database: {
      type: "sqlite",
      db,
    } as any,
    plugins: [
      creem({
        apiKey,
        webhookSecret,
        testMode: true,
        persistSubscriptions: true,
      }),
    ],
  });

  return { auth, db };
}
