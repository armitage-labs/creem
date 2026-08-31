import { betterAuth } from "better-auth";
import { creem } from "../../../../dist/esm/index";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import path from "path";

// Initialize database with absolute path
const dbPath = path.join(process.cwd(), "auth.db");
const sqlite = new Database(dbPath);

// Create Kysely instance (required by Better Auth)
const db = new Kysely({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
});

// Check if Creem is configured
const hasValidCreemApiKey =
  process.env.CREEM_API_KEY && process.env.CREEM_API_KEY !== "your-creem-api-key-here";

// Build plugins array conditionally
const plugins = [];

if (hasValidCreemApiKey) {
  plugins.push(
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      testMode: process.env.CREEM_TEST_MODE === "true",
      defaultSuccessUrl: "/dashboard",
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET,

      // Grant access when subscription is created or updated
      onGrantAccess: async (context) => {
        console.log("🎉 Granting access to user:", {
          customerEmail: context.customer.email,
          productId: context.product.id,
          reason: context.reason,
          metadata: context.metadata,
        });

        // Here you would typically:
        // 1. Update user's role/permissions in your database
        // 2. Send welcome email
        // 3. Log the event

        // Example: Update user subscription status
        // await db.prepare(`
        //   UPDATE user
        //   SET subscriptionStatus = ?,
        //       subscriptionId = ?,
        //       productId = ?
        //   WHERE id = ?
        // `).run('active', context.metadata.subscriptionId, context.product.id, context.customer.userId);
      },

      // Revoke access when subscription ends or is cancelled
      onRevokeAccess: async (context) => {
        console.log("🚫 Revoking access from user:", {
          customerEmail: context.customer.email,
          productId: context.product.id,
          reason: context.reason,
          metadata: context.metadata,
        });

        // Here you would typically:
        // 1. Remove user's premium permissions
        // 2. Send notification email
        // 3. Log the event

        // Example: Update user subscription status
        // await db.prepare(`
        //   UPDATE user
        //   SET subscriptionStatus = ?
        //   WHERE id = ?
        // `).run('cancelled', context.customer.userId);
      },
    }),
  );
} else {
  console.warn(
    "⚠️  Creem plugin not configured. Set CREEM_API_KEY in .env.local to enable payment features.",
  );
}

export const auth = betterAuth({
  database: {
    db,
    type: "sqlite",
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },
  plugins,
});
