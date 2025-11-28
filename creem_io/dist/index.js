'use strict';

var crypto = require('crypto');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var crypto__default = /*#__PURE__*/_interopDefault(crypto);

// validate.ts
function required(value, name) {
  if (value === void 0 || value === null || value === "") {
    throw new Error(`Missing required parameter: ${name}`);
  }
}
function requiredWhen(value, name, condition) {
  if (value === void 0 || value === null || value === "") {
    throw new Error(
      `Missing required parameter: ${name}. ${name} is required when ${condition}`
    );
  }
}
function isString(value, name) {
  if (value !== void 0 && typeof value !== "string") {
    throw new Error(`Parameter '${name}' must be a string`);
  }
}
function isNumber(value, name) {
  if (value !== void 0 && typeof value !== "number") {
    throw new Error(`Parameter '${name}' must be a number`);
  }
}
function isBoolean(value, name) {
  if (value !== void 0 && typeof value !== "boolean") {
    throw new Error(`Parameter '${name}' must be a boolean`);
  }
}
function isArray(value, name) {
  if (value !== void 0 && !Array.isArray(value)) {
    throw new Error(`Parameter '${name}' must be an array`);
  }
}

// resources/products.ts
var productsResource = (request) => ({
  list: (params = {}) => {
    isNumber(params.page, "page");
    isNumber(params.limit, "limit");
    return request("GET", "/v1/products/search", void 0, {
      page_number: params.page,
      page_size: params.limit
    });
  },
  get: (params) => {
    required(params.productId, "productId");
    isString(params.productId, "productId");
    return request("GET", "/v1/products", void 0, {
      product_id: params.productId
    });
  },
  create: (params) => {
    required(params.name, "name");
    isString(params.name, "name");
    isString(params.imageUrl, "imageUrl");
    required(params.description, "description");
    isString(params.description, "description");
    required(params.price, "price");
    isNumber(params.price, "price");
    required(params.currency, "currency");
    isString(params.currency, "currency");
    required(params.billingType, "billingType");
    isString(params.billingType, "billingType");
    if (params.billingType === "recurring") {
      requiredWhen(
        params.billingPeriod,
        "billingPeriod",
        "billingType is 'recurring'"
      );
      isString(params.billingPeriod, "billingPeriod");
    }
    isString(params.taxMode, "taxMode");
    isString(params.taxCategory, "taxCategory");
    isString(params.defaultSuccessUrl, "defaultSuccessUrl");
    isArray(params.customField, "customField");
    isBoolean(
      params.abandonedCartRecoveryEnabled,
      "abandonedCartRecoveryEnabled"
    );
    return request("POST", "/v1/products", {
      name: params.name,
      description: params.description,
      image_url: params.imageUrl,
      price: params.price,
      currency: params.currency,
      billing_type: params.billingType,
      billing_period: params.billingPeriod,
      tax_mode: params.taxMode,
      tax_category: params.taxCategory,
      default_success_url: params.defaultSuccessUrl,
      custom_field: params.customField,
      abandoned_cart_recovery_enabled: params.abandonedCartRecoveryEnabled
    });
  }
});

// resources/checkouts.ts
var checkoutsResource = (request) => ({
  get: (params) => {
    required(params.checkoutId, "checkoutId");
    isString(params.checkoutId, "checkoutId");
    return request("GET", "/v1/checkouts", void 0, {
      checkout_id: params.checkoutId
    });
  },
  create: (params) => {
    isString(params.requestId, "requestId");
    required(params.productId, "productId");
    isString(params.productId, "productId");
    isNumber(params.units, "units");
    isString(params.discountCode, "discountCode");
    isArray(params.customField, "customField");
    isString(params.successUrl, "successUrl");
    return request("POST", "/v1/checkouts", {
      request_id: params.requestId,
      product_id: params.productId,
      units: params.units,
      discount_code: params.discountCode,
      customer: params.customer,
      custom_field: params.customField,
      success_url: params.successUrl,
      // TODO: Check if is possible to create a URL here with /success
      metadata: params.metadata
    });
  }
});

// resources/customers.ts
var customersResource = (request) => ({
  list: (params = {}) => {
    isNumber(params.page, "page");
    isNumber(params.limit, "limit");
    return request("GET", "/v1/customers/list", void 0, {
      page_number: params.page,
      page_size: params.limit
    });
  },
  get: (params) => {
    isString(params.customerId, "customerId");
    isString(params.email, "email");
    if (!params.customerId && !params.email) {
      throw new Error(
        "Either 'customerId' or 'email' must be provided to get a customer."
      );
    }
    return request("GET", "/v1/customers", void 0, {
      customer_id: params.customerId,
      email: params.email
    });
  },
  createPortal: (params) => {
    required(params.customerId, "customerId");
    isString(params.customerId, "customerId");
    return request("POST", "/v1/customers/billing", {
      customer_id: params.customerId
    });
  }
});

// resources/subscriptions.ts
var subscriptionsResource = (request) => ({
  get: (params) => {
    required(params.subscriptionId, "subscriptionId");
    isString(params.subscriptionId, "subscriptionId");
    return request("GET", "/v1/subscriptions", void 0, {
      subscription_id: params.subscriptionId
    });
  },
  cancel: (params) => {
    required(params.subscriptionId, "subscriptionId");
    isString(params.subscriptionId, "subscriptionId");
    return request(
      "POST",
      `/v1/subscriptions/${params.subscriptionId}/cancel`
    );
  },
  update: (params) => {
    required(params.subscriptionId, "subscriptionId");
    isString(params.subscriptionId, "subscriptionId");
    isArray(params.items, "items");
    isString(params.updateBehavior, "updateBehavior");
    return request(
      "POST",
      `/v1/subscriptions/${params.subscriptionId}`,
      {
        items: params.items?.map((item) => ({
          id: item.id,
          product_id: item.productId,
          price_id: item.priceId,
          units: item.units
        })),
        update_behavior: params.updateBehavior
      }
    );
  },
  upgrade: (params) => {
    required(params.subscriptionId, "subscriptionId");
    isString(params.subscriptionId, "subscriptionId");
    required(params.productId, "productId");
    isString(params.productId, "productId");
    isString(params.updateBehavior, "updateBehavior");
    return request(
      "POST",
      `/v1/subscriptions/${params.subscriptionId}/upgrade`,
      {
        product_id: params.productId,
        update_behavior: params.updateBehavior
      }
    );
  }
});

// resources/transactions.ts
var transactionsResource = (request) => ({
  get: (params) => {
    required(params.transactionId, "transactionId");
    isString(params.transactionId, "transactionId");
    return request("GET", "/v1/transactions", void 0, {
      transaction_id: params.transactionId
    });
  },
  list: (params = {}) => {
    isString(params.customerId, "customerId");
    isString(params.orderId, "orderId");
    isString(params.productId, "productId");
    isNumber(params.page, "page");
    isNumber(params.limit, "limit");
    return request(
      "GET",
      "/v1/transactions/search",
      void 0,
      {
        customer_id: params.customerId,
        order_id: params.orderId,
        product_id: params.productId,
        page_number: params.page,
        page_size: params.limit
      }
    );
  }
});

// resources/licenses.ts
var licensesResource = (request) => ({
  activate: (params) => {
    required(params.key, "key");
    isString(params.key, "key");
    required(params.instanceName, "instanceName");
    isString(params.instanceName, "instanceName");
    return request("POST", "/v1/licenses/activate", {
      key: params.key,
      instance_name: params.instanceName
    });
  },
  deactivate: (params) => {
    required(params.key, "key");
    isString(params.key, "key");
    required(params.instanceId, "instanceId");
    isString(params.instanceId, "instanceId");
    return request("POST", "/v1/licenses/deactivate", {
      key: params.key,
      instance_id: params.instanceId
    });
  },
  validate: (params) => {
    required(params.key, "key");
    isString(params.key, "key");
    required(params.instanceId, "instanceId");
    isString(params.instanceId, "instanceId");
    return request("POST", "/v1/licenses/validate", {
      key: params.key,
      instance_id: params.instanceId
    });
  }
});

// resources/discounts.ts
var discountsResource = (request) => ({
  get: (params) => {
    isString(params.discountId, "discountId");
    isString(params.discountCode, "discountCode");
    if (!params.discountId && !params.discountCode) {
      throw new Error(
        "Either 'discountId' or 'discountCode' must be provided to get a discount."
      );
    }
    return request("GET", "/v1/discounts", void 0, {
      discount_id: params.discountId,
      discount_code: params.discountCode
    });
  },
  create: (params) => {
    required(params.name, "name");
    isString(params.name, "name");
    isString(params.code, "code");
    required(params.type, "type");
    isString(params.type, "type");
    isNumber(params.amount, "amount");
    isString(params.currency, "currency");
    isNumber(params.percentage, "percentage");
    isString(params.expiryDate, "expiryDate");
    isNumber(params.maxRedemptions, "maxRedemptions");
    required(params.duration, "duration");
    isString(params.duration, "duration");
    isNumber(params.durationInMonths, "durationInMonths");
    isArray(params.appliesToProducts, "appliesToProducts");
    return request("POST", "/v1/discounts", {
      name: params.name,
      code: params.code,
      type: params.type,
      amount: params.amount,
      currency: params.currency,
      percentage: params.percentage,
      expiry_date: params.expiryDate,
      max_redemptions: params.maxRedemptions,
      duration: params.duration,
      duration_in_months: params.durationInMonths,
      applies_to_products: params.appliesToProducts
    });
  },
  delete: (params) => {
    required(params.discountId, "discountId");
    isString(params.discountId, "discountId");
    return request(
      "DELETE",
      `/v1/discounts/${params.discountId}/delete`
    );
  }
});

// utils.ts
function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map((v) => toCamelCase(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

// resources/webhooks.ts
function isWebhookEntity(obj) {
  if (!obj || typeof obj !== "object") return false;
  const entity = obj;
  return typeof entity.object === "string" && [
    "checkout",
    "customer",
    "order",
    "product",
    "subscription",
    "refund",
    "dispute",
    "transaction"
  ].includes(entity.object);
}
function isWebhookEvent(obj) {
  if (!obj || typeof obj !== "object") return false;
  const event = obj;
  return typeof event.eventType === "string" && typeof event.id === "string" && typeof event.created_at === "number" && "object" in event && isWebhookEntity(event.object);
}
function parseWebhookEvent(payload) {
  const event = JSON.parse(payload);
  if (!isWebhookEvent(event)) {
    throw new Error("Invalid webhook event structure");
  }
  return event;
}
function generateSignature(payload, secret) {
  return crypto__default.default.createHmac("sha256", secret).update(payload).digest("hex");
}
function verifySignature(payload, signature, secret) {
  const expectedSignature = generateSignature(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto__default.default.timingSafeEqual(signatureBuffer, expectedBuffer);
}
function normalizeWebhookData(data) {
  return toCamelCase(data);
}
var webhooksResource = (secret) => {
  return {
    /**
     * Handle incoming webhook events with signature verification.
     * Framework-agnostic - works with Express, Next.js, Fastify, etc.
     *
     * @param payload - The raw request body (string or Buffer). Do not pass parsed JSON.
     * @param signature - The signature from the request headers (typically "creem-signature").
     * @param handlers - An object mapping event handlers.
     * @throws {Error} If webhook secret is not configured or signature is invalid.
     *
     * @example
     * // Next.js App Router
     * export async function POST(req: Request) {
     *   const payload = await req.text();
     *   const signature = req.headers.get("creem-signature")!;
     *
     *   try {
     *     await creem.webhooks.handleEvents(payload, signature, {
     *       onCheckoutCompleted: async (data) => {
     *         console.log("Checkout:", data.customer?.email);
     *       },
     *       onGrantAccess: async (context) => {
     *         // Grant access logic
     *       },
     *     });
     *     return new Response("OK", { status: 200 });
     *   } catch (err) {
     *     return new Response("Invalid signature", { status: 400 });
     *   }
     * }
     *
     * @example
     * // Express
     * app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
     *   const payload = req.body.toString();
     *   const signature = req.headers['creem-signature'];
     *
     *   try {
     *     await creem.webhooks.handleEvents(payload, signature, {
     *       onCheckoutCompleted: async (data) => {
     *         console.log("Checkout:", data.customer?.email);
     *       },
     *     });
     *     res.status(200).send("OK");
     *   } catch (err) {
     *     res.status(400).send("Invalid signature");
     *   }
     * });
     */
    handleEvents: async (payload, signature, handlers) => {
      if (!secret) {
        throw new Error(
          "Webhook secret not configured. Pass `webhookSecret` to `createCreem`."
        );
      }
      const payloadString = typeof payload === "string" ? payload : payload.toString("utf8");
      if (!verifySignature(payloadString, signature, secret)) {
        throw new Error("Invalid webhook signature");
      }
      const event = parseWebhookEvent(payloadString);
      const normalizedObject = normalizeWebhookData(event.object);
      switch (event.eventType) {
        case "checkout.completed": {
          const checkoutData = normalizedObject;
          await handlers.onCheckoutCompleted?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...checkoutData
          });
          break;
        }
        case "refund.created": {
          const refundData = normalizedObject;
          await handlers.onRefundCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...refundData
          });
          break;
        }
        case "dispute.created": {
          const disputeData = normalizedObject;
          await handlers.onDisputeCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...disputeData
          });
          break;
        }
        case "subscription.active": {
          const subscriptionData = normalizedObject;
          await handlers.onGrantAccess?.({
            reason: "subscription_active",
            ...subscriptionData
          });
          await handlers.onSubscriptionActive?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.trialing": {
          const subscriptionData = normalizedObject;
          await handlers.onGrantAccess?.({
            reason: "subscription_trialing",
            ...subscriptionData
          });
          await handlers.onSubscriptionTrialing?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.paid": {
          const subscriptionData = normalizedObject;
          await handlers.onGrantAccess?.({
            reason: "subscription_paid",
            ...subscriptionData
          });
          await handlers.onSubscriptionPaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.paused": {
          const subscriptionData = normalizedObject;
          await handlers.onRevokeAccess?.({
            reason: "subscription_paused",
            ...subscriptionData
          });
          await handlers.onSubscriptionPaused?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.expired": {
          const subscriptionData = normalizedObject;
          await handlers.onRevokeAccess?.({
            reason: "subscription_expired",
            ...subscriptionData
          });
          await handlers.onSubscriptionExpired?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.canceled": {
          const subscriptionData = normalizedObject;
          await handlers.onSubscriptionCanceled?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.unpaid": {
          const subscriptionData = normalizedObject;
          await handlers.onSubscriptionUnpaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.update": {
          const subscriptionData = normalizedObject;
          await handlers.onSubscriptionUpdate?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        case "subscription.past_due": {
          const subscriptionData = normalizedObject;
          await handlers.onSubscriptionPastDue?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData
          });
          break;
        }
        default:
          console.warn(`Unknown webhook event type: ${event.eventType}`);
          break;
      }
    }
  };
};

// request.ts
var createRequest = (apiKey, baseUrl) => {
  return async (method, path, data, queryParams) => {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "User-Agent": "creem-sdk-node/0.1.0"
    };
    const url = new URL(`${baseUrl}${path}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== void 0) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: data ? JSON.stringify(data) : void 0
    });
    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorMessage;
      } catch {
      }
      throw new Error(errorMessage);
    }
    if (response.status === 204) {
      return {};
    }
    const responseData = await response.json();
    return toCamelCase(responseData);
  };
};

// index.ts
function createCreem({
  apiKey,
  webhookSecret,
  testMode = false
}) {
  const baseUrl = testMode ? "https://test-api.creem.io" : "https://api.creem.io";
  const request = createRequest(apiKey, baseUrl);
  return {
    products: productsResource(request),
    checkouts: checkoutsResource(request),
    customers: customersResource(request),
    subscriptions: subscriptionsResource(request),
    transactions: transactionsResource(request),
    licenses: licensesResource(request),
    discounts: discountsResource(request),
    webhooks: webhooksResource(webhookSecret)
  };
}

exports.createCreem = createCreem;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map