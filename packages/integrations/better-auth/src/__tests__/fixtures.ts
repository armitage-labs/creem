import { vi } from "vitest";
import type { GenericEndpointContext } from "better-auth";
import type { CreemOptions } from "../types.js";
import type {
  CustomerEntity,
  ProductEntity,
  SubscriptionEntity,
  CheckoutEntity,
  OrderEntity,
  NormalizedSubscriptionEntity,
  NormalizedCheckoutEntity,
  NormalizedCheckoutCompletedEvent,
  NormalizedSubscriptionActiveEvent,
  NormalizedSubscriptionTrialingEvent,
  NormalizedSubscriptionCanceledEvent,
  NormalizedSubscriptionPaidEvent,
  NormalizedSubscriptionExpiredEvent,
  NormalizedSubscriptionPausedEvent,
  RefundEntity,
  DisputeEntity,
  TransactionEntity,
  DiscountEntity,
} from "@creem_io/webhook-types";

// ============================================================================
// Mock Customer
// ============================================================================
export const mockCustomer: CustomerEntity = {
  id: "cust_test_123",
  object: "customer",
  mode: "test",
  email: "test@example.com",
  name: "Test User",
  country: "US",
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
};

// ============================================================================
// Mock Product
// ============================================================================
export const mockProduct: ProductEntity = {
  id: "prod_test_456",
  object: "product",
  mode: "test",
  name: "Test Product",
  description: "A test product",
  price: 1000,
  currency: "USD",
  billing_type: "recurring",
  billing_period: "every-month",
  status: "active",
  tax_mode: "inclusive",
  tax_category: "saas",
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
};

// ============================================================================
// Mock Subscription
// ============================================================================
export const mockSubscription: NormalizedSubscriptionEntity = {
  id: "sub_test_789",
  object: "subscription",
  mode: "test",
  product: mockProduct,
  customer: mockCustomer,
  collection_method: "charge_automatically",
  status: "active",
  current_period_start_date: new Date("2024-01-01"),
  current_period_end_date: new Date("2025-01-01"),
  canceled_at: null,
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
  metadata: { referenceId: "user_123" },
};

// ============================================================================
// Mock Order
// ============================================================================
export const mockOrder: OrderEntity = {
  id: "ord_test_101",
  object: "order",
  mode: "test",
  customer: "cust_test_123",
  product: "prod_test_456",
  amount: 1000,
  currency: "USD",
  status: "paid",
  type: "recurring",
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
};

// ============================================================================
// Mock Checkout
// ============================================================================
export const mockCheckout: NormalizedCheckoutEntity = {
  id: "chk_test_202",
  object: "checkout",
  mode: "test",
  status: "completed",
  request_id: "req_123",
  product: mockProduct,
  units: 1,
  order: mockOrder,
  subscription: {
    id: "sub_test_789",
    object: "subscription",
    mode: "test",
    product: "prod_test_456",
    customer: "cust_test_123",
    collection_method: "charge_automatically",
    status: "active",
    current_period_start_date: new Date("2024-01-01"),
    current_period_end_date: new Date("2025-01-01"),
    canceled_at: null,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
    metadata: { referenceId: "user_123" },
  },
  customer: mockCustomer,
  checkout_url: "https://checkout.creem.io/test",
  success_url: "https://example.com/success",
  metadata: { referenceId: "user_123" },
};

// ============================================================================
// Mock Transaction
// ============================================================================
export const mockTransaction: TransactionEntity = {
  id: "txn_test_303",
  object: "transaction",
  mode: "test",
  amount: 1000,
  currency: "USD",
  type: "invoice",
  status: "paid",
  description: "Monthly subscription",
  created_at: Date.now() / 1000,
};

// ============================================================================
// Mock Refund
// ============================================================================
export const mockRefund: RefundEntity = {
  id: "ref_test_404",
  object: "refund",
  mode: "test",
  status: "succeeded",
  refund_amount: 1000,
  refund_currency: "USD",
  reason: "requested_by_customer",
  transaction: mockTransaction,
  created_at: Date.now() / 1000,
};

// ============================================================================
// Mock Dispute
// ============================================================================
export const mockDispute: DisputeEntity = {
  id: "dis_test_505",
  object: "dispute",
  mode: "test",
  amount: 1000,
  currency: "USD",
  transaction: mockTransaction,
  created_at: Date.now() / 1000,
};

// ============================================================================
// Mock Discount
// ============================================================================
export const mockDiscount: DiscountEntity = {
  id: "disc_test_606",
  object: "discount",
  mode: "test",
  status: "active",
  name: "Summer Sale",
  code: "SUMMER20",
  type: "percentage",
  percentage: 20,
  duration: "once",
  redeem_count: 5,
};

// ============================================================================
// Mock Webhook Events
// ============================================================================
export const mockCheckoutCompletedEvent: NormalizedCheckoutCompletedEvent = {
  eventType: "checkout.completed",
  id: "evt_chk_001",
  created_at: Date.now() / 1000,
  object: mockCheckout,
};

export const mockSubscriptionActiveEvent: NormalizedSubscriptionActiveEvent = {
  eventType: "subscription.active",
  id: "evt_sub_001",
  created_at: Date.now() / 1000,
  object: mockSubscription,
};

export const mockSubscriptionTrialingEvent: NormalizedSubscriptionTrialingEvent = {
  eventType: "subscription.trialing",
  id: "evt_sub_002",
  created_at: Date.now() / 1000,
  object: { ...mockSubscription, status: "trialing" },
};

export const mockSubscriptionCanceledEvent: NormalizedSubscriptionCanceledEvent = {
  eventType: "subscription.canceled",
  id: "evt_sub_003",
  created_at: Date.now() / 1000,
  object: { ...mockSubscription, status: "canceled" },
};

export const mockSubscriptionPaidEvent: NormalizedSubscriptionPaidEvent = {
  eventType: "subscription.paid",
  id: "evt_sub_004",
  created_at: Date.now() / 1000,
  object: { ...mockSubscription, status: "active" },
};

export const mockSubscriptionExpiredEvent: NormalizedSubscriptionExpiredEvent = {
  eventType: "subscription.expired",
  id: "evt_sub_005",
  created_at: Date.now() / 1000,
  object: {
    ...mockSubscription,
    status: "canceled",
    current_period_end_date: new Date("2023-01-01"),
  },
};

export const mockSubscriptionPausedEvent: NormalizedSubscriptionPausedEvent = {
  eventType: "subscription.paused",
  id: "evt_sub_006",
  created_at: Date.now() / 1000,
  object: { ...mockSubscription, status: "paused" },
};

// ============================================================================
// Default CreemOptions
// ============================================================================
export const defaultOptions: CreemOptions = {
  apiKey: "test_api_key_123",
  webhookSecret: "test_webhook_secret_456",
  testMode: true,
  persistSubscriptions: true,
};

export const optionsNoPersist: CreemOptions = {
  ...defaultOptions,
  persistSubscriptions: false,
};

// ============================================================================
// Mock DB Adapter
// ============================================================================
export function createMockAdapter() {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (args: any) => ({
      id: "new_sub_id",
      ...args.data,
    })),
    update: vi.fn().mockResolvedValue({}),
  };
}

// ============================================================================
// Mock Error Adapter (throws on all methods)
// ============================================================================
export function createErrorAdapter(errorMessage = "Database error") {
  return {
    findOne: vi.fn().mockRejectedValue(new Error(errorMessage)),
    findMany: vi.fn().mockRejectedValue(new Error(errorMessage)),
    create: vi.fn().mockRejectedValue(new Error(errorMessage)),
    update: vi.fn().mockRejectedValue(new Error(errorMessage)),
  };
}

// ============================================================================
// Mock Context
// ============================================================================
export function createMockContext(overrides?: {
  body?: any;
  headers?: Record<string, string>;
  requestText?: string;
  adapter?: ReturnType<typeof createMockAdapter>;
  request?: Request | null;
}) {
  const adapter = overrides?.adapter ?? createMockAdapter();

  const headers = new Headers(overrides?.headers || {});

  const request =
    overrides?.request !== undefined
      ? overrides.request
      : new Request("https://example.com/api", {
          method: "POST",
          headers,
        });

  // Patch request.text if requestText is provided
  if (request && overrides?.requestText !== undefined) {
    const text = overrides.requestText;
    (request as any).text = vi.fn().mockResolvedValue(text);
  }

  const jsonFn = vi.fn().mockImplementation((data: any, opts?: any) => {
    return { data, status: opts?.status ?? 200 };
  });

  const ctx = {
    body: overrides?.body ?? {},
    request,
    context: {
      adapter,
    },
    json: jsonFn,
  } as unknown as GenericEndpointContext & {
    json: ReturnType<typeof vi.fn>;
    context: { adapter: ReturnType<typeof createMockAdapter> };
  };

  return ctx;
}

// ============================================================================
// Mock Creem SDK
// ============================================================================
export function createMockCreem() {
  return {
    checkouts: {
      create: vi.fn().mockResolvedValue({
        checkoutUrl: "https://checkout.creem.io/test-session",
      }),
    },
    customers: {
      generateBillingLinks: vi.fn().mockResolvedValue({
        customerPortalLink: "https://portal.creem.io/test-portal",
      }),
    },
    subscriptions: {
      cancel: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({
        id: "sub_test_789",
        status: "active",
        product: mockProduct,
        customer: mockCustomer,
      }),
    },
    transactions: {
      search: vi.fn().mockResolvedValue({
        transactions: [mockTransaction],
        total: 1,
      }),
    },
  };
}

// ============================================================================
// Mock DB subscription record
// ============================================================================
export const mockDbSubscription = {
  id: "db_sub_001",
  productId: "prod_test_456",
  referenceId: "user_123",
  creemCustomerId: "cust_test_123",
  creemSubscriptionId: "sub_test_789",
  creemOrderId: "ord_test_101",
  status: "active",
  periodStart: new Date("2024-01-01"),
  periodEnd: new Date("2025-01-01"),
  cancelAtPeriodEnd: false,
};

// ============================================================================
// Mock User
// ============================================================================
export const mockUser = {
  id: "user_123",
  email: "test@example.com",
  creemCustomerId: "cust_test_123",
  hadTrial: false,
};
