/**
 * Metadata type for storing arbitrary key-value pairs
 */
type Metadata = Record<string, string | number | null>;
/**
 * Pagination details
 */
interface Pagination {
    /** Total number of records in the list */
    totalRecords: number;
    /** Total number of pages available */
    totalPages: number;
    /** The current page number */
    currentPage: number;
    /** The next page number, or null if there is no next page */
    nextPage: number | null;
    /** The previous page number, or null if there is no previous page */
    prevPage: number | null;
}
/**
 * Base entity interface that all Creem objects extend
 */
interface BaseEntity {
    /** Unique identifier for the object */
    id: string;
    /** Environment mode: test, prod, or sandbox */
    mode: "test" | "prod" | "sandbox";
}

/**
 * License instance entity
 */
interface LicenseInstance extends BaseEntity {
    /** String representing the object's type */
    object: "license-instance";
    /** The name of the license instance */
    name: string;
    /** The status of the license instance */
    status: "active" | "deactivated";
    /** The creation date of the license instance */
    createdAt: Date;
}
/**
 * License entity
 */
interface License extends BaseEntity {
    /** String representing the object's type */
    object: "license";
    /** The current status of the license key */
    status: "inactive" | "active" | "expired" | "disabled";
    /** The license key */
    key: string;
    /** The number of instances that this license key was activated */
    activation: number;
    /** The activation limit. Null if activations are unlimited */
    activationLimit: number | null;
    /** The date the license key expires. Null if no expiration */
    expiresAt: Date | null;
    /** The creation date of the license key */
    createdAt: Date;
    /** Associated license instance */
    instance?: LicenseInstance | null;
}
/**
 * Request payload for activating a license
 */
interface ActivateLicenseRequest {
    /** The license key to activate */
    key: string;
    /** The name of the instance to activate */
    instanceName: string;
}
/**
 * Request payload for deactivating a license
 */
interface DeactivateLicenseRequest {
    /** The license key to deactivate */
    key: string;
    /** The instance ID to deactivate */
    instanceId: string;
}
/**
 * Request payload for validating a license
 */
interface ValidateLicenseRequest {
    /** The license key to validate */
    key: string;
    /** The instance ID to validate */
    instanceId: string;
}

/**
 * Product feature entity
 */
interface Feature {
    /** Unique identifier for the feature */
    id: string;
    /** The feature type */
    type: "custom" | "github-repo" | "discord" | "file" | "link" | "licence-key";
    /** A brief description of the feature */
    description: string;
}
/**
 * Product entity
 */
interface Product extends BaseEntity {
    /** String representing the object's type */
    object: "product";
    /** The name of the product */
    name: string;
    /** A brief description of the product */
    description: string;
    /** URL of the product image. Only png and jpg are supported */
    imageUrl?: string;
    /** Features of the product */
    features?: Feature[];
    /** The price of the product in cents. 1000 = $10.00 */
    price: number;
    /** Three-letter ISO currency code, in uppercase */
    currency: string;
    /** Billing method: recurring or onetime */
    billingType: "recurring" | "onetime";
    /** Billing period */
    billingPeriod: "every-month" | "every-three-months" | "every-six-months" | "every-year" | "once";
    /** Status of the product */
    status: "active" | "archived";
    /** Tax calculation mode */
    taxMode: "inclusive" | "exclusive";
    /** Tax category for the product */
    taxCategory: "saas" | "digital-goods-service" | "ebooks";
    /** The product page URL for express checkout */
    productUrl?: string;
    /** The URL to redirect after successful payment */
    defaultSuccessUrl?: string;
    /** Creation date of the product */
    createdAt: Date;
    /** Last updated date of the product */
    updatedAt: Date;
}
/**
 * Product feature entity (issued for orders)
 */
interface ProductFeature {
    /** License key issued for the order */
    license?: License;
}
/**
 * Product list response
 */
interface ProductList {
    /** List of products */
    items: Product[];
    /** Pagination details */
    pagination: Pagination;
}
/**
 * Request payload for listing products
 */
interface ListProductsRequest {
    /** Page number for pagination */
    page?: number;
    /** Number of items per page */
    limit?: number;
}
/**
 * Request payload for retrieving a product
 */
interface GetProductRequest {
    /** The product ID to retrieve */
    productId: string;
}
/**
 * Custom field definition for product creation
 */
interface CustomFieldDefinition {
    /** The type of the field */
    type: "text" | "checkbox";
    /** Unique key for custom field. Must be unique to this field, alphanumeric, and up to 200 characters. */
    key: string;
    /** The label for the field, displayed to the customer, up to 50 characters */
    label: string;
    /** Whether the customer is required to complete the field. Defaults to `false` */
    optional?: boolean;
    /** Configuration for text field type */
    text?: {
        maxLength?: number;
        minLength?: number;
    };
    /** Configuration for checkbox field type */
    checkbox?: {
        label?: string;
    };
}
/**
 * Request payload for creating a product
 */
interface CreateProductRequest {
    /** The name of the product */
    name: string;
    /** A brief description of the product */
    description: string;
    /** URL of the product image */
    imageUrl?: string;
    /** The price of the product in cents. 1000 = $10.00 */
    price: number;
    /** Three-letter ISO currency code, in uppercase */
    currency: string;
    /** Billing method: recurring or onetime */
    billingType: "recurring" | "onetime";
    /** Billing period (required when billingType is "recurring") */
    billingPeriod?: "every-month" | "every-three-months" | "every-six-months" | "every-year" | "once";
    /** Tax calculation mode */
    taxMode?: "inclusive" | "exclusive";
    /** Tax category for the product */
    taxCategory?: "saas" | "digital-goods-service" | "ebooks";
    /** The URL to redirect after successful payment */
    defaultSuccessUrl?: string;
    /** Custom fields for the product */
    customField?: CustomFieldDefinition[];
    /** Whether abandoned cart recovery is enabled */
    abandonedCartRecoveryEnabled?: boolean;
}

/**
 * Transaction entity
 */
interface Transaction extends BaseEntity {
    /** String representing the object's type */
    object: "transaction";
    /** The transaction amount in cents. 1000 = $10.00 */
    amount: number;
    /** The amount the customer paid in cents. 1000 = $10.00 */
    amountPaid?: number;
    /** The discount amount in cents. 1000 = $10.00 */
    discountAmount?: number;
    /** Three-letter ISO currency code, in uppercase */
    currency: string;
    /** The type of transaction: payment (one time) or invoice (subscription) */
    type: "payment" | "invoice";
    /** The ISO alpha-2 country code where tax is collected */
    taxCountry?: string;
    /** The sale tax amount in cents. 1000 = $10.00 */
    taxAmount?: number;
    /** Status of the transaction */
    status: "pending" | "paid" | "refunded" | "partialRefund" | "chargedBack" | "uncollectible" | "declined" | "void";
    /** The amount that has been refunded in cents. 1000 = $10.00 */
    refundedAmount?: number | null;
    /** The order ID associated with the transaction */
    order?: string;
    /** The subscription ID associated with the transaction */
    subscription?: string;
    /** The customer ID associated with the transaction */
    customer?: string;
    /** The description of the transaction */
    description?: string;
    /** Start period for the invoice as timestamp */
    periodStart?: number;
    /** End period for the invoice as timestamp */
    periodEnd?: number;
    /** Creation date of the transaction as timestamp */
    createdAt: number;
}
/**
 * Order entity
 */
interface Order extends BaseEntity {
    /** String representing the object's type */
    object: "order";
    /** The customer ID who placed the order */
    customer?: string;
    /** The product ID associated with the order */
    product: string;
    /** The transaction ID of the order */
    transaction?: string;
    /** The discount ID of the order */
    discount?: string;
    /** The total amount of the order in cents. 1000 = $10.00 */
    amount: number;
    /** The subtotal of the order in cents. 1000 = $10.00 */
    subTotal?: number;
    /** The tax amount of the order in cents. 1000 = $10.00 */
    taxAmount?: number;
    /** The discount amount of the order in cents. 1000 = $10.00 */
    discountAmount?: number;
    /** The amount due for the order in cents. 1000 = $10.00 */
    amountDue?: number;
    /** The amount paid for the order in cents. 1000 = $10.00 */
    amountPaid?: number;
    /** Three-letter ISO currency code, in uppercase */
    currency: string;
    /** The amount in the foreign currency, if applicable */
    fxAmount?: number;
    /** Three-letter ISO code of the foreign currency, if applicable */
    fxCurrency?: string;
    /** The exchange rate used for converting between currencies */
    fxRate?: number;
    /** Current status of the order */
    status: "pending" | "paid";
    /** The type of order */
    type: "recurring" | "onetime";
    /** The affiliate ID associated with the order, if applicable */
    affiliate?: string;
    /** Creation date of the order */
    createdAt: Date;
    /** Last updated date of the order */
    updatedAt: Date;
}
/**
 * Transaction list response
 */
interface TransactionList {
    /** List of transactions */
    items: Transaction[];
    /** Pagination details */
    pagination: Pagination;
}
/**
 * Request payload for retrieving a transaction
 */
interface GetTransactionRequest {
    /** The transaction ID to retrieve */
    transactionId: string;
}
/**
 * Request payload for listing transactions
 */
interface ListTransactionsRequest {
    /** Filter by customer ID */
    customerId?: string;
    /** Filter by order ID */
    orderId?: string;
    /** Filter by product ID */
    productId?: string;
    /** Page number for pagination */
    page?: number;
    /** Number of items per page */
    limit?: number;
}

/**
 * Customer entity
 */
interface Customer extends BaseEntity {
    /** String representing the object's type */
    object: "customer";
    /** Customer email address */
    email: string;
    /** Customer name */
    name?: string;
    /** The ISO alpha-2 country code for the customer */
    country: string;
    /** Creation date of the customer */
    createdAt: Date;
    /** Last updated date of the customer */
    updatedAt: Date;
}
/**
 * Customer list response
 */
interface CustomerList {
    /** List of customers */
    items: Customer[];
    /** Pagination details */
    pagination: Pagination;
}
/**
 * Customer portal links
 */
interface CustomerLinks {
    /** URL to the customer portal */
    customerPortalLink: string;
}
/**
 * Request payload for listing customers
 */
interface ListCustomersRequest {
    /** Page number for pagination */
    page?: number;
    /** Number of items per page */
    limit?: number;
}
/**
 * Request payload for retrieving a customer
 */
interface GetCustomerRequest {
    /** The customer ID to retrieve */
    customerId?: string;
    /** The customer email to retrieve */
    email?: string;
}
/**
 * Request payload for generating a customer portal link
 */
interface GenerateCustomerPortalLinkRequest {
    /** The customer ID to generate a portal link for */
    customerId: string;
}

/**
 * Subscription item entity
 */
interface SubscriptionItem extends BaseEntity {
    /** String representing the object's type */
    object: "subscription_item";
    /** The product ID associated with the subscription item */
    productId?: string;
    /** The price ID associated with the subscription item */
    priceId?: string;
    /** The number of units for the subscription item */
    units?: number;
}
/**
 * Subscription status
 */
type SubscriptionStatus = "active" | "canceled" | "unpaid" | "paused" | "trialing" | "scheduled_cancel";
/**
 * Subscription entity
 */
interface Subscription extends BaseEntity {
    /** String representing the object's type */
    object: "subscription";
    /** The product associated with the subscription */
    product: Product | string;
    /** The customer who owns the subscription */
    customer: Customer | string;
    /** Subscription items */
    items?: SubscriptionItem[];
    /** The method used for collecting payments */
    collectionMethod: "charge_automatically";
    /** The current status of the subscription */
    status: SubscriptionStatus;
    /** The ID of the last paid transaction */
    lastTransactionId?: string;
    /** The last paid transaction */
    lastTransaction?: Transaction;
    /** The date of the last paid transaction */
    lastTransactionDate?: Date;
    /** The date when the next subscription transaction will be charged */
    nextTransactionDate?: Date;
    /** The start date of the current subscription period */
    currentPeriodStartDate: Date;
    /** The end date of the current subscription period */
    currentPeriodEndDate: Date;
    /** The date when the subscription was canceled, if applicable */
    canceledAt: Date | null;
    /** The date when the subscription was created */
    createdAt: Date;
    /** The date when the subscription was last updated */
    updatedAt: Date;
    /** The discount code applied to the subscription, if any */
    discount?: object;
    /** Optional metadata */
    metadata?: Metadata;
}
/**
 * Subscription entity as returned in subscription webhook events.
 * The product and customer are always expanded (full objects, never just IDs).
 */
interface NormalizedSubscription extends Omit<Subscription, "product" | "customer"> {
    /** The product associated with the subscription (always expanded in webhooks) */
    product: Product;
    /** The customer who owns the subscription (always expanded in webhooks) */
    customer: Customer;
}
/**
 * Request payload for retrieving a subscription
 */
interface GetSubscriptionRequest {
    /** The subscription ID to retrieve */
    subscriptionId: string;
}
/**
 * Request payload for canceling a subscription
 */
interface CancelSubscriptionRequest {
    /** The subscription ID to cancel */
    subscriptionId: string;
}
/**
 * Subscription item update
 */
interface SubscriptionItemUpdate {
    /** The subscription item ID */
    id?: string;
    /** The product ID */
    productId?: string;
    /** The price ID */
    priceId?: string;
    /** The number of units */
    units?: number;
}
/**
 * Request payload for updating a subscription
 */
interface UpdateSubscriptionRequest {
    /** The subscription ID to update */
    subscriptionId: string;
    /** The subscription items to update */
    items?: SubscriptionItemUpdate[];
    /** How to handle the update */
    updateBehavior?: "proration-charge-immediately" | "proration-charge" | "proration-none";
}
/**
 * Request payload for upgrading a subscription
 */
interface UpgradeSubscriptionRequest {
    /** The subscription ID to upgrade */
    subscriptionId: string;
    /** The new product ID */
    productId: string;
    /** How to handle the upgrade */
    updateBehavior?: "proration-charge-immediately" | "proration-charge" | "proration-none";
}

/**
 * Text field configuration for custom fields
 */
interface Text {
    /** Maximum character length constraint for the input */
    maxLength?: number;
    /** Minimum character length requirement for the input */
    minLength?: number;
}
/**
 * Checkbox field configuration for custom fields
 */
interface Checkbox {
    /** The markdown text to display for the checkbox */
    label?: string;
}
/**
 * Custom field configuration
 */
interface CustomField {
    /** The type of the field */
    type: "text" | "checkbox";
    /** Unique key for custom field. Must be unique, alphanumeric, up to 200 characters */
    key: string;
    /** The label for the field, displayed to the customer, up to 50 characters */
    label: string;
    /** Whether the customer is required to complete the field. Defaults to false */
    optional?: boolean;
    /** Configuration for text field type */
    text?: Text;
    /** Configuration for checkbox field type */
    checkbox?: Checkbox;
}
/**
 * Checkout status
 */
type CheckoutStatus = "pending" | "processing" | "completed" | "expired";
/**
 * Checkout entity
 */
interface Checkout extends BaseEntity {
    /** String representing the object's type */
    object: "checkout";
    /** Status of the checkout */
    status: CheckoutStatus;
    /** Request ID to identify and track each checkout request */
    requestId?: string;
    /** The product associated with the checkout session */
    product: Product | string;
    /** The number of units for the product */
    units: number;
    /** The order associated with the checkout session */
    order?: Order;
    /** The subscription associated with the checkout session */
    subscription?: Subscription | string;
    /** The customer associated with the checkout session */
    customer?: Customer | string;
    /** Additional information collected during checkout */
    customFields?: CustomField[];
    /** The URL to complete the payment */
    checkoutUrl?: string;
    /** The URL to redirect after checkout is completed */
    successUrl?: string;
    /** Features issued for the order */
    feature?: ProductFeature[];
    /** Metadata for the checkout */
    metadata?: Metadata;
}
/**
 * Subscription entity as nested in checkout.completed events.
 * Note: In checkout events, the nested subscription has product/customer as ID strings.
 */
interface NestedSubscriptionInCheckout extends Omit<Subscription, "product" | "customer"> {
    /** The product ID (string, not expanded in nested subscription) */
    product: string;
    /** The customer ID (string, not expanded in nested subscription) */
    customer: string;
}
/**
 * Checkout entity as returned in checkout.completed webhook events.
 * Product and customer are always expanded.
 * Subscription is also expanded but has product/customer as strings inside it.
 */
interface NormalizedCheckout extends Omit<Checkout, "product" | "customer" | "subscription"> {
    /** The product associated with the checkout (always expanded in webhooks) */
    product: Product;
    /** The customer associated with the checkout (always expanded in webhooks) */
    customer?: Customer;
    /** The subscription associated with the checkout (expanded, but nested fields are IDs) */
    subscription?: NestedSubscriptionInCheckout;
}
/**
 * Customer information for checkout creation
 */
interface CheckoutCustomer {
    /** Unique identifier of the customer. You may specify only one of these parameters: id or email. */
    id?: string;
    /** Customer email address. You may only specify one of these parameters: id, email. */
    email?: string;
}
/**
 * Request payload for creating a checkout session
 */
interface CreateCheckoutRequest {
    /** Idempotency key to prevent duplicate checkouts */
    requestId?: string;
    /** The Creem product ID to checkout */
    productId: string;
    /** Number of units to purchase. Defaults to 1 if not provided */
    units?: number;
    /** Discount code to apply to the checkout */
    discountCode?: string;
    /** Customer information for the checkout */
    customer?: CheckoutCustomer;
    /** Custom fields to include with the checkout (max 3) */
    customField?: CustomField[];
    /** URL to redirect to after successful checkout */
    successUrl?: string;
    /** Additional metadata to store with the checkout */
    metadata?: Metadata;
}
/**
 * Request payload for retrieving a checkout session
 */
interface GetCheckoutRequest {
    /** The checkout ID to retrieve */
    checkoutId: string;
}

/**
 * Discount status
 */
type DiscountStatus = "active" | "draft" | "expired" | "scheduled";
/**
 * Discount type
 */
type DiscountType = "percentage" | "fixed";
/**
 * Discount duration
 */
type DiscountDuration = "forever" | "once" | "repeating";
/**
 * Discount entity
 */
interface Discount {
    /** Unique identifier for the discount */
    id: string;
    /** Environment mode: test, prod, or sandbox */
    mode: "test" | "prod" | "sandbox";
    /** String representing the object's type */
    object: string;
    /** Status of the discount */
    status: DiscountStatus;
    /** Display name of the discount */
    name: string;
    /** The discount code customers will use */
    code: string;
    /** Type of discount: percentage or fixed amount */
    type: DiscountType;
    /** Fixed discount amount in cents (for fixed type). 1000 = $10.00 */
    amount?: number;
    /** Three-letter ISO currency code, in uppercase (for fixed type) */
    currency?: string;
    /** The percentage of the discount. Only applicable if type is "percentage". 25 = 25% off */
    percentage?: number;
    /** The date when the discount expires */
    expiryDate?: Date;
    /** Maximum number of times this discount can be redeemed */
    maxRedemptions?: number;
    /** How long the discount applies to subscriptions */
    duration?: DiscountDuration;
    /** Number of months the discount applies (for repeating duration) */
    durationInMonths?: number;
    /** List of product IDs this discount applies to */
    appliesToProducts?: string[];
    /** Number of times this discount has been redeemed */
    redeemCount?: number;
}
/**
 * Request payload for creating a discount
 */
interface CreateDiscountRequest {
    /** Display name of the discount */
    name: string;
    /** The discount code customers will use. Auto-generated if not provided */
    code?: string;
    /** Type of discount: percentage or fixed amount */
    type: DiscountType;
    /** Fixed discount amount in cents (required for fixed type) */
    amount?: number;
    /** Three-letter ISO currency code, in uppercase (required for fixed type) */
    currency?: string;
    /** The percentage of the discount. Only applicable if type is "percentage". 25 = 25% off */
    percentage?: number;
    /** The date when the discount expires */
    expiryDate?: Date;
    /** Maximum number of times this discount can be redeemed */
    maxRedemptions?: number;
    /** How long the discount applies to subscriptions */
    duration: DiscountDuration;
    /** Number of months the discount applies (for repeating duration) */
    durationInMonths?: number;
    /** List of product IDs this discount applies to */
    appliesToProducts?: string[];
}
/**
 * Request payload for retrieving a discount
 */
interface GetDiscountRequest {
    /** The discount ID to retrieve */
    discountId?: string;
    /** The discount code to retrieve */
    discountCode?: string;
}
/**
 * Request payload for deleting a discount
 */
interface DeleteDiscountRequest {
    /** The discount ID to delete */
    discountId: string;
}

/**
 * Creem Webhook Types
 *
 * This file contains all TypeScript types needed to work with Creem webhooks.
 * It's designed to be framework-agnostic and fully type-safe.
 *
 * No external dependencies required - just TypeScript!
 */

/**
 * Refund entity
 */
interface Refund {
    /** String representing the object's type */
    object: "refund";
    /** Unique identifier for the object */
    id: string;
    /** Environment mode: test, prod, or sandbox */
    mode: "test" | "prod" | "sandbox";
    /** Status of the refund */
    status: "pending" | "succeeded" | "canceled" | "failed";
    /** The refunded amount in cents. 1000 = $10.00 */
    refundAmount: number;
    /** Three-letter ISO currency code, in uppercase */
    refundCurrency: string;
    /** Reason for the refund */
    reason: "duplicate" | "fraudulent" | "requested_by_customer" | "other";
    /** The transaction associated with the refund */
    transaction: Transaction;
    /** The checkout associated with the refund */
    checkout?: Checkout | string;
    /** The order associated with the refund */
    order?: string;
    /** The subscription associated with the refund */
    subscription?: Subscription | string;
    /** The customer associated with the refund */
    customer?: Customer | string;
    /** Creation date as timestamp */
    createdAt: number;
}
/**
 * Normalized refund entity with expanded relations
 */
interface NormalizedRefund extends Omit<Refund, "transaction"> {
    /** The transaction is always expanded */
    transaction: Transaction;
}
/**
 * Dispute entity
 */
interface Dispute {
    /** String representing the object's type */
    object: "dispute";
    /** Unique identifier for the object */
    id: string;
    /** Environment mode: test, prod, or sandbox */
    mode: "test" | "prod" | "sandbox";
    /** The disputed amount in cents. 1000 = $10.00 */
    amount: number;
    /** Three-letter ISO currency code, in uppercase */
    currency: string;
    /** The transaction associated with the dispute */
    transaction: Transaction;
    /** The checkout associated with the dispute */
    checkout?: Checkout | string;
    /** The order associated with the dispute */
    order?: string;
    /** The subscription associated with the dispute */
    subscription?: Subscription | string;
    /** The customer associated with the dispute */
    customer?: Customer | string;
    /** Creation date as timestamp */
    createdAt: number;
}
/**
 * Normalized dispute entity with expanded relations
 */
interface NormalizedDispute extends Omit<Dispute, "transaction"> {
    /** The transaction is always expanded */
    transaction: Transaction;
}

/**
 * Checkout completed event callback parameter.
 * All properties are at the top level for easy destructuring.
 */
type CheckoutCompletedEvent = {
    /** Webhook event type identifier */
    webhookEventType: "checkout.completed";
    /** Unique webhook event ID */
    webhookId: string;
    /** Webhook event creation timestamp */
    webhookCreatedAt: number;
} & NormalizedCheckout;
/**
 * Refund created event callback parameter.
 */
type RefundCreatedEvent = {
    /** Webhook event type identifier */
    webhookEventType: "refund.created";
    /** Unique webhook event ID */
    webhookId: string;
    /** Webhook event creation timestamp */
    webhookCreatedAt: number;
} & NormalizedRefund;
/**
 * Dispute created event callback parameter.
 */
type DisputeCreatedEvent = {
    /** Webhook event type identifier */
    webhookEventType: "dispute.created";
    /** Unique webhook event ID */
    webhookId: string;
    /** Webhook event creation timestamp */
    webhookCreatedAt: number;
} & NormalizedDispute;
/**
 * Subscription event callback parameter.
 */
type SubscriptionEvent<T extends string> = {
    /** Webhook event type identifier */
    webhookEventType: T;
    /** Unique webhook event ID */
    webhookId: string;
    /** Webhook event creation timestamp */
    webhookCreatedAt: number;
} & NormalizedSubscription;
/**
 * Reasons for granting access
 */
type GrantAccessReason = "subscription_active" | "subscription_trialing" | "subscription_paid";
/**
 * Reasons for revoking access
 */
type RevokeAccessReason = "subscription_paused" | "subscription_expired";
/**
 * Context passed to onGrantAccess callback.
 * All subscription properties are flattened for easy destructuring.
 */
type GrantAccessContext = {
    /** The reason for granting access */
    reason: GrantAccessReason;
} & NormalizedSubscription;
/**
 * Context passed to onRevokeAccess callback.
 * All subscription properties are flattened for easy destructuring.
 */
type RevokeAccessContext = {
    /** The reason for revoking access */
    reason: RevokeAccessReason;
} & NormalizedSubscription;
/**
 * Webhook configuration options
 */
interface WebhookOptions {
    /**
     * Creem Webhook Secret (for signature verification)
     * @required
     */
    webhookSecret: string;
    /**
     * Called when a checkout is completed.
     * All properties are flattened for easy destructuring.
     *
     * @example
     * onCheckoutCompleted: async ({ webhookEventType, product, customer, order, subscription }) => {
     *   console.log(`Checkout completed: ${customer?.email} purchased ${product.name}`);
     * }
     */
    onCheckoutCompleted?: (data: CheckoutCompletedEvent) => void | Promise<void>;
    /**
     * Called when a refund is created.
     */
    onRefundCreated?: (data: RefundCreatedEvent) => void | Promise<void>;
    /**
     * Called when a dispute is created.
     */
    onDisputeCreated?: (data: DisputeCreatedEvent) => void | Promise<void>;
    /**
     * Called when a subscription becomes active.
     *
     * @example
     * onSubscriptionActive: async ({ product, customer, status }) => {
     *   console.log(`${customer.email} subscribed to ${product.name}`);
     * }
     */
    onSubscriptionActive?: (data: SubscriptionEvent<"subscription.active">) => void | Promise<void>;
    /**
     * Called when a subscription is in trialing state.
     */
    onSubscriptionTrialing?: (data: SubscriptionEvent<"subscription.trialing">) => void | Promise<void>;
    /**
     * Called when a subscription is canceled.
     */
    onSubscriptionCanceled?: (data: SubscriptionEvent<"subscription.canceled">) => void | Promise<void>;
    /**
     * Called when a subscription is paid.
     */
    onSubscriptionPaid?: (data: SubscriptionEvent<"subscription.paid">) => void | Promise<void>;
    /**
     * Called when a subscription has expired.
     */
    onSubscriptionExpired?: (data: SubscriptionEvent<"subscription.expired">) => void | Promise<void>;
    /**
     * Called when a subscription is unpaid.
     */
    onSubscriptionUnpaid?: (data: SubscriptionEvent<"subscription.unpaid">) => void | Promise<void>;
    /**
     * Called when a subscription is updated.
     */
    onSubscriptionUpdate?: (data: SubscriptionEvent<"subscription.update">) => void | Promise<void>;
    /**
     * Called when a subscription is past due.
     */
    onSubscriptionPastDue?: (data: SubscriptionEvent<"subscription.past_due">) => void | Promise<void>;
    /**
     * Called when a subscription is paused.
     */
    onSubscriptionPaused?: (data: SubscriptionEvent<"subscription.paused">) => void | Promise<void>;
    /**
     * Called when a user should be granted access to the platform.
     * This is triggered for: active, trialing, and paid subscriptions.
     *
     * NOTE: This may be called multiple times for the same user/subscription.
     * Implement this as an idempotent operation (safe to call repeatedly).
     *
     * @example
     * onGrantAccess: async ({ reason, product, customer, metadata }) => {
     *   const userId = metadata?.referenceId as string;
     *   console.log(`Granting ${reason} to ${customer.email} for ${product.name}`);
     *   // Your database logic here
     * }
     */
    onGrantAccess?: (context: GrantAccessContext) => void | Promise<void>;
    /**
     * Called when a user's access should be revoked.
     * This is triggered for: paused, expired, and canceled (after period ends) subscriptions.
     *
     * NOTE: This may be called multiple times for the same user/subscription.
     * Implement this as an idempotent operation (safe to call repeatedly).
     *
     * @example
     * onRevokeAccess: async ({ reason, product, customer, metadata }) => {
     *   const userId = metadata?.referenceId as string;
     *   console.log(`Revoking access (${reason}) from ${customer.email}`);
     *   // Your database logic here
     * }
     */
    onRevokeAccess?: (context: RevokeAccessContext) => void | Promise<void>;
}

interface CreemOptions {
    apiKey: string;
    webhookSecret?: string;
    testMode?: boolean;
}
declare function createCreem({ apiKey, webhookSecret, testMode, }: CreemOptions): {
    products: {
        list: (params?: ListProductsRequest) => Promise<ProductList>;
        get: (params: GetProductRequest) => Promise<Product>;
        create: (params: CreateProductRequest) => Promise<Product>;
    };
    checkouts: {
        get: (params: GetCheckoutRequest) => Promise<Checkout>;
        create: (params: CreateCheckoutRequest) => Promise<Checkout>;
    };
    customers: {
        list: (params?: ListCustomersRequest) => Promise<CustomerList>;
        get: (params: GetCustomerRequest) => Promise<Customer>;
        createPortal: (params: GenerateCustomerPortalLinkRequest) => Promise<CustomerLinks>;
    };
    subscriptions: {
        get: (params: GetSubscriptionRequest) => Promise<Subscription>;
        cancel: (params: CancelSubscriptionRequest) => Promise<Subscription>;
        update: (params: UpdateSubscriptionRequest) => Promise<Subscription>;
        upgrade: (params: UpgradeSubscriptionRequest) => Promise<Subscription>;
    };
    transactions: {
        get: (params: GetTransactionRequest) => Promise<Transaction>;
        list: (params?: ListTransactionsRequest) => Promise<TransactionList>;
    };
    licenses: {
        activate: (params: ActivateLicenseRequest) => Promise<License>;
        deactivate: (params: DeactivateLicenseRequest) => Promise<License>;
        validate: (params: ValidateLicenseRequest) => Promise<License>;
    };
    discounts: {
        get: (params: GetDiscountRequest) => Promise<Discount>;
        create: (params: CreateDiscountRequest) => Promise<Discount>;
        delete: (params: DeleteDiscountRequest) => Promise<Discount>;
    };
    webhooks: {
        handleEvents: (payload: string | Buffer, signature: string, handlers: Omit<WebhookOptions, "webhookSecret">) => Promise<void>;
    };
};

export { createCreem };
