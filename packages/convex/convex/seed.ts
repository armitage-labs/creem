import { Creem } from "creem";
import type { CreateProductRequestEntity } from "creem/models/components";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const apiKey = process.env.CREEM_API_KEY ?? "";
const serverIdx = process.env.CREEM_SERVER_IDX
  ? Number(process.env.CREEM_SERVER_IDX)
  : undefined;
const serverURL = process.env.CREEM_SERVER_URL;

const creem = new Creem({
  apiKey,
  ...(serverIdx !== undefined ? { serverIdx } : {}),
  ...(serverURL ? { serverURL } : {}),
});

export const PREMIUM_PLAN_NAME = "Premium Plan";
export const PREMIUM_PLUS_PLAN_NAME = "Premium Plus Plan";
export const COMMUNITY_PLAN_NAME = "Community Plan";
export const SUPPORTER_PLAN_NAME = "Supporter Plan";
export const TEAM_PLAN_NAME = "Team Plan";
export const API_PLAN_NAME = "API Plan";

const createRecurringProduct = (request: {
  name: string;
  description: string;
  price: number;
  billingPeriod: "every-month" | "every-year";
}): CreateProductRequestEntity => ({
  name: request.name,
  description: request.description,
  price: request.price,
  currency: "USD",
  billingType: "recurring",
  billingPeriod: request.billingPeriod,
});

export const insertFakeUser = internalMutation({
  handler: async (ctx) => {
    const existingUser = await ctx.db.query("users").first();
    if (existingUser) {
      console.log("User already exists");
      return;
    }
    await ctx.db.insert("users", { email: "user@example.com" });
  },
});

const seed = internalAction({
  handler: async (ctx) => {
    // Insert a fake user for test purposes since this example doesn't have
    // working authentication.
    await ctx.runMutation(internal.seed.insertFakeUser);

    const firstPage = await creem.products.search(1, 1);
    const hasProducts = firstPage.items.length > 0;

    // Return early if the Creem account already has products, ensures
    // this doesn't run more than once.
    if (hasProducts) {
      console.log("Products already exist");
      return;
    }

    const premiumMonthly = await creem.products.create(
      createRecurringProduct({
        name: PREMIUM_PLAN_NAME,
        description: "All the things for one low monthly price.",
        price: 1000,
        billingPeriod: "every-month",
      }),
    );
    const premiumYearly = await creem.products.create(
      createRecurringProduct({
        name: PREMIUM_PLAN_NAME,
        description: "All the things for one low annual price.",
        price: 10000,
        billingPeriod: "every-year",
      }),
    );
    const premiumPlusMonthly = await creem.products.create(
      createRecurringProduct({
        name: PREMIUM_PLUS_PLAN_NAME,
        description: "All the things for one low monthly price.",
        price: 2000,
        billingPeriod: "every-month",
      }),
    );
    const premiumPlusYearly = await creem.products.create(
      createRecurringProduct({
        name: PREMIUM_PLUS_PLAN_NAME,
        description: "All the things for one low annual price.",
        price: 20000,
        billingPeriod: "every-year",
      }),
    );

    console.log("Created products", {
      premiumMonthly: premiumMonthly.id,
      premiumYearly: premiumYearly.id,
      premiumPlusMonthly: premiumPlusMonthly.id,
      premiumPlusYearly: premiumPlusYearly.id,
    });
  },
});

// Utility action to inspect products in the account.
export const archiveAll = internalAction({
  handler: async () => {
    const products = await creem.products.search(1, 100);
    console.log(
      "Current products",
      products.items.map((product) => ({ id: product.id, name: product.name })),
    );
  },
});

export default seed;
