-- ===========================================================================
-- Aperture - database schema
-- ===========================================================================
-- Two groups of tables:
--   1. Better Auth core + Creem plugin tables (user, session, account,
--      verification, creem_subscription). These mirror what
--      `npx @better-auth/cli migrate` would generate; we inline them so a
--      single `pnpm db:migrate` bootstraps a fresh database.
--   2. App-specific tables that map users to Creem credit wallets and record
--      generations plus a cached view of the credit ledger.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Better Auth: user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
  "id"             TEXT PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL UNIQUE,
  "emailVerified"  BOOLEAN NOT NULL DEFAULT FALSE,
  "image"          TEXT,
  -- Fields added by the Creem plugin schema:
  "creemCustomerId" TEXT,
  "hadTrial"        BOOLEAN DEFAULT FALSE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Better Auth: session
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "session" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token"     TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Better Auth: account (credentials + OAuth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "account" (
  "id"                    TEXT PRIMARY KEY,
  "userId"                TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accountId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "accessTokenExpiresAt"  TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope"                 TEXT,
  "idToken"               TEXT,
  "password"              TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Better Auth: verification
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "verification" (
  "id"         TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Creem plugin: creem_subscription
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "creem_subscription" (
  "id"                  TEXT PRIMARY KEY,
  "productId"           TEXT NOT NULL,
  "referenceId"         TEXT NOT NULL,
  "creemCustomerId"     TEXT,
  "creemSubscriptionId" TEXT,
  "creemOrderId"        TEXT,
  "status"              TEXT DEFAULT 'pending',
  "periodStart"         TIMESTAMPTZ,
  "periodEnd"           TIMESTAMPTZ,
  "cancelAtPeriodEnd"   BOOLEAN DEFAULT FALSE,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================================
-- App tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- credit_account - maps one app user to one Creem credit wallet.
--   account_id is a Creem cca_… id; provider is always 'creem'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "credit_account" (
  "user_id"           TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "creem_customer_id" TEXT NOT NULL,
  "account_id"        TEXT NOT NULL,
  "provider"          TEXT NOT NULL DEFAULT 'creem',
  "unit_label"        TEXT NOT NULL DEFAULT 'credits',
  "status"            TEXT NOT NULL DEFAULT 'active',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- generation - one row per generation attempt. Records the full ordered flow
-- (moderate -> debit -> generate -> return) and its outcome for auditing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "generation" (
  "id"               TEXT PRIMARY KEY,
  "user_id"          TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "prompt"           TEXT NOT NULL,
  "media_type"       TEXT NOT NULL DEFAULT 'image',    -- 'image' | 'video'
  "cost"             INTEGER NOT NULL,
  "status"           TEXT NOT NULL,   -- rejected | insufficient_credits | generating | completed | failed | refunded
  "moderation_decision" TEXT,          -- allow | flag | deny | error
  "debit_txn_id"     TEXT,
  "result_url"       TEXT,
  "error"            TEXT,
  "idempotency_key"  TEXT NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "generation_user_idx"
  ON "generation" ("user_id", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- credit_ledger_cache - a denormalised, fast-to-read mirror of every wallet
-- movement (whether it happened in Creem or locally). Powers the transaction
-- history UI without a round-trip to Creem on every page load, and keeps an
-- audit trail even after an account is closed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "credit_ledger_cache" (
  "id"             TEXT PRIMARY KEY,
  "user_id"        TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "account_id"     TEXT NOT NULL,
  "transaction_id" TEXT,
  "side"           TEXT NOT NULL,          -- 'credit' | 'debit'
  "amount"         NUMERIC NOT NULL,
  "reference"      TEXT,
  "kind"           TEXT,                   -- pack_purchase | generation | refund | adjustment
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ledger_cache_user_idx"
  ON "credit_ledger_cache" ("user_id", "created_at" DESC);
