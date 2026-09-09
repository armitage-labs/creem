import { Webhook } from "@creem_io/nextjs";

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,

  // Checkout events
  onGrantAccess: async ({ reason, customer, metadata }) => {
    console.log("Grant access", reason, customer, metadata);
  },
  onCheckoutCompleted: async ({ product, customer }) => {
    console.log("Checkout completed", product, customer);
  },
});
