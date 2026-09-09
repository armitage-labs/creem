import type { Core } from "@strapi/strapi";
import type { Method } from "axios";
import axios from "axios";
import * as crypto from "crypto";
import type { CreemEnvironment } from "../services/creem-service";

const PLUGIN_ID = "strapi5-plugin-for-creem";

export type PluginSettings = {
  environment: CreemEnvironment;
  /** Default presentment currency for new products (ISO code, e.g. EUR, USD). */
  defaultCurrency?: string;
  checkout: {
    successUrl?: string;
  };
  webhook?: {
    forwardUrl?: string;
  };
};

type ProductListResponse = {
  items: CreemProduct[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
};

type CreemProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_type: "onetime" | "recurring";
  billing_period?: string;
  status?: "active" | "archived";
  features?: { id: string; type: string; description?: string }[];
  [key: string]: unknown;
};

type CreemService = {
  creemRequest: <T>(
    env: CreemEnvironment,
    method: Method,
    path: string,
    config?: import("axios").AxiosRequestConfig,
  ) => Promise<T>;
};

function getCreemService(strapi: Core.Strapi): CreemService {
  return strapi.plugin(PLUGIN_ID).service("creemService") as CreemService;
}

function getEnvironmentAvailability(): { test: boolean; production: boolean } {
  return {
    test: Boolean(process.env.STRAPI_CREEM_TEST_API_KEY),
    production: Boolean(process.env.STRAPI_CREEM_API_KEY),
  };
}

function mapBillingPeriod(value: string): string {
  switch (value) {
    case "day":
      return "every-day";
    case "month":
      return "every-month";
    case "3months":
      return "every-three-months";
    case "6months":
      return "every-six-months";
    case "year":
      return "every-year";
    default:
      return "every-month";
  }
}

function verifyCreemSignature(payload: string, secret: string, signature: string): boolean {
  const computed = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (computed.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const getSettingsInternal = async (): Promise<PluginSettings | null> => {
    return (await strapi
      .store({ type: "plugin", name: PLUGIN_ID })
      .get({ key: "settings" })) as PluginSettings | null;
  };

  const creem = () => getCreemService(strapi);

  return {
    async getSettings(ctx) {
      const s = await getSettingsInternal();
      ctx.body = { ...(s || {}), availableEnvironments: getEnvironmentAvailability() };
    },

    async updateSettings(ctx) {
      const data = ctx.request.body as PluginSettings;
      const avail = getEnvironmentAvailability();
      if (data.environment === "test" && !avail.test) {
        ctx.throw(400, "Test API key is not configured (set STRAPI_CREEM_TEST_API_KEY)");
      }
      if (data.environment === "production" && !avail.production) {
        ctx.throw(400, "Production API key is not configured (set STRAPI_CREEM_API_KEY)");
      }
      if (data.checkout?.successUrl) {
        const u = new URL(data.checkout.successUrl);
        if (data.environment === "production" && u.protocol !== "https:") {
          ctx.throw(400, "successUrl must be HTTPS in production");
        }
      }
      await strapi.store({ type: "plugin", name: PLUGIN_ID }).set({ key: "settings", value: data });
      ctx.body = { ok: true };
    },

    async listProducts(ctx) {
      const settings = (await getSettingsInternal()) as PluginSettings;
      const env = settings?.environment ?? "test";
      const pageSize = Number(ctx.query.limit) || 100;
      const pageNumber = Number(ctx.query.page) || 1;
      const res = await creem().creemRequest<ProductListResponse>(env, "GET", "/products/search", {
        params: { page_number: pageNumber, page_size: pageSize },
      });
      const items = (res.items ?? []).filter((p) => p.status !== "archived");
      ctx.body = { items, pagination: res.pagination };
    },

    async getProduct(ctx) {
      const settings = (await getSettingsInternal()) as PluginSettings;
      const env = settings?.environment ?? "test";
      ctx.body = await creem().creemRequest(env, "GET", "/products", {
        params: { product_id: ctx.params.id },
      });
    },

    async createProduct(ctx) {
      const settings = (await getSettingsInternal()) as PluginSettings;
      const env = settings?.environment ?? "test";
      const body = ctx.request.body as Record<string, unknown>;

      const currency = String(body.currency || settings.defaultCurrency || "USD").toUpperCase();
      const cents = Math.round(Number(body.price) * 100);
      let priceAmount: number;
      if (cents === 0) {
        priceAmount = 0;
      } else if (cents < 100) {
        ctx.throw(400, "Price must be 0 (free product) or at least 1.00 in the selected currency");
      } else {
        priceAmount = cents;
      }
      const isSub = body.paymentType === "subscription";

      const productPayload: Record<string, unknown> = {
        name: body.name,
        description: (body.description as string) || String(body.name),
        price: priceAmount,
        currency,
        billing_type: isSub ? "recurring" : "onetime",
        tax_mode: "exclusive",
      };

      if (isSub)
        productPayload.billing_period = mapBillingPeriod(String(body.recurringInterval || "month"));

      if (settings?.checkout?.successUrl) {
        productPayload.default_success_url = settings.checkout.successUrl;
      }

      const features: Record<string, unknown>[] = [];
      if (body.include_license_keys) {
        features.push({
          type: "licenseKey",
          licenseKey: {
            expiryUnit: 1,
            activationLimit: 1,
            expiryInterval: "year",
            unlimitedExpiry: false,
            unlimitedActivation: false,
          },
          description:
            (body.license_benefit_description as string) || `${String(body.name)}: License key`,
        });
      }
      if (body.include_private_note) {
        features.push({
          type: "custom",
          description:
            (body.custom_note_benefit_description as string) ||
            `${String(body.name)}: Private note`,
          custom: {
            private_note: (body.private_note as string) || "",
          },
        });
      }
      if (features.length > 0) {
        productPayload.features = features;
      }

      const product = await creem().creemRequest<CreemProduct>(env, "POST", "/products", {
        data: productPayload,
      });
      ctx.body = product;
    },

    async updateProduct(ctx) {
      const settings = (await getSettingsInternal()) as PluginSettings;
      const env = settings?.environment ?? "test";
      const patch = ctx.request.body as Record<string, unknown>;
      const payload: Record<string, unknown> = {};
      if (patch.name != null) payload.name = patch.name;
      if (patch.description != null) payload.description = patch.description;

      if (Object.keys(payload).length === 0) {
        ctx.throw(400, "No supported fields to update");
      }

      try {
        ctx.body = await creem().creemRequest(env, "PATCH", "/products", {
          params: { product_id: ctx.params.id },
          data: payload,
        });
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 404 || err.status === 405) {
          ctx.throw(
            501,
            "Creem API does not support updating products yet. Edit name and description in the Creem dashboard.",
          );
        }
        throw e;
      }
    },

    async checkout(ctx) {
      const settings = (await getSettingsInternal()) as PluginSettings;
      const env = settings?.environment ?? "test";
      const body = ctx.request.body as {
        productId?: string;
        customer_email?: string;
        success_url?: string;
        metadata?: Record<string, string | number | boolean>;
        request_id?: string;
      };
      if (!body.productId || !body.customer_email)
        ctx.throw(400, "Missing productId or customer_email");

      const configuredSuccess = settings?.checkout?.successUrl;
      const successUrl = configuredSuccess || body.success_url;
      if (settings?.environment === "production" && successUrl) {
        const u = new URL(successUrl);
        if (u.protocol !== "https:") ctx.throw(400, "success_url must be HTTPS in production");
      }

      const payload: Record<string, unknown> = {
        product_id: body.productId,
        customer: { email: body.customer_email },
        metadata: body.metadata || {},
      };
      if (successUrl) payload.success_url = successUrl;
      if (body.request_id) payload.request_id = body.request_id;

      const session = await creem().creemRequest<{ checkout_url?: string }>(
        env,
        "POST",
        "/checkouts",
        { data: payload },
      );
      const url = session.checkout_url;
      if (!url) ctx.throw(502, "Creem checkout session did not return a checkout_url");
      ctx.body = { url };
    },

    async webhook(ctx) {
      const settings = (await getSettingsInternal()) as PluginSettings;
      const secret = process.env.STRAPI_CREEM_WEBHOOK_SECRET;
      if (!secret) ctx.throw(400, "STRAPI_CREEM_WEBHOOK_SECRET is not set");

      const signature = ctx.request.headers["creem-signature"] as string | undefined;
      if (!signature) ctx.throw(403, "Missing creem-signature header");

      const rawBody =
        typeof ctx.request.body === "string"
          ? ctx.request.body
          : ((ctx.request.rawBody as string | undefined) ?? JSON.stringify(ctx.request.body));

      try {
        if (!verifyCreemSignature(rawBody, secret, signature)) {
          ctx.throw(403, "Invalid Creem webhook signature");
        }
      } catch (e) {
        if ((e as { status?: number }).status === 403) throw e;
        ctx.throw(403, "Invalid Creem webhook signature");
      }

      const event =
        typeof ctx.request.body === "string" ? JSON.parse(ctx.request.body) : ctx.request.body;
      const forwardUrl = settings?.webhook?.forwardUrl;
      if (forwardUrl) {
        await axios.post(forwardUrl, event, {
          headers: {
            "Content-Type": "application/json",
            "Creem-Event-Type": String(event?.eventType ?? ""),
          },
          timeout: 10000,
        });
      }

      ctx.status = 200;
      ctx.body = { received: true };
    },
  };
};
