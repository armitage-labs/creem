# CREEM API Reference

Complete API reference with all endpoints, request/response schemas, and field descriptions.

## Base Configuration

```
Production: https://api.creem.io
Test Mode:  https://test-api.creem.io
Version:    v1
```

## Authentication

All requests require the `x-api-key` header:

```http
x-api-key: creem_your_api_key_here
```

API keys are found in the dashboard under Settings > API Keys. Test and production use different keys.

---

## Checkouts API

### Create Checkout Session

Creates a new checkout session and returns a URL to redirect the customer.

```http
POST /v1/checkouts
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | string | Yes | Product ID to purchase (e.g., `prod_abc123`) |
| `request_id` | string | No | Your tracking ID for this checkout |
| `units` | number | No | Number of units/seats (default: 1) |
| `discount_code` | string | No | Pre-fill discount code |
| `customer` | object | No | Pre-fill customer data |
| `customer.email` | string | No | Customer's email address |
| `customer.id` | string | No | Existing customer ID |
| `success_url` | string | No | Redirect URL after payment |
| `metadata` | object | No | Key-value pairs for tracking |
| `custom_fields` | array | No | Additional fields to collect (max 3) |

**Custom Fields Schema:**

```json
{
  "custom_fields": [
    {
      "type": "text",
      "key": "companyName",
      "label": "Company Name",
      "optional": false,
      "text": {
        "min_length": 1,
        "max_length": 200
      }
    },
    {
      "type": "checkbox",
      "key": "termsAccepted",
      "label": "Accept Terms",
      "optional": false,
      "checkbox": {
        "label": "I agree to the [terms](https://example.com/terms)"
      }
    }
  ]
}
```

**Response: CheckoutEntity**

```json
{
  "id": "ch_1234567890",
  "mode": "test",
  "object": "checkout",
  "status": "pending",
  "checkout_url": "https://checkout.creem.io/ch_1234567890",
  "product": "prod_abc123",
  "units": 1,
  "request_id": "order_123",
  "success_url": "https://yoursite.com/success",
  "metadata": { "userId": "user_123" }
}
```

### Retrieve Checkout

```http
GET /v1/checkouts?checkout_id={id}
```

**Query Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `checkout_id` | string | Yes | Checkout session ID |

**Response:** Full `CheckoutEntity` with expanded `product`, `customer`, `order`, `subscription`, and `feature` objects if checkout is completed.

---

## Products API

### Create Product

```http
POST /v1/products
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Product name |
| `description` | string | No | Product description |
| `image_url` | string | No | Product image URL (PNG/JPG) |
| `price` | integer | Yes | Price in cents (min: 100) |
| `currency` | string | Yes | ISO currency code (USD, EUR, etc.) |
| `billing_type` | string | Yes | `recurring` or `onetime` |
| `billing_period` | string | If recurring | `every-month`, `every-year`, etc. |
| `tax_mode` | string | No | `inclusive` or `exclusive` |
| `tax_category` | string | No | `saas`, `digital-goods-service`, `ebooks` |
| `default_success_url` | string | No | Default redirect after payment |
| `custom_fields` | array | No | Fields to collect at checkout |
| `abandoned_cart_recovery_enabled` | boolean | No | Enable cart recovery emails |

**Response: ProductEntity**

```json
{
  "id": "prod_abc123",
  "mode": "test",
  "object": "product",
  "name": "Pro Plan",
  "description": "Full access to all features",
  "image_url": "https://example.com/image.jpg",
  "price": 2900,
  "currency": "USD",
  "billing_type": "recurring",
  "billing_period": "every-month",
  "status": "active",
  "tax_mode": "exclusive",
  "tax_category": "saas",
  "product_url": "https://creem.io/product/prod_abc123",
  "default_success_url": "https://example.com/success",
  "features": [],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Retrieve Product

```http
GET /v1/products?product_id={id}
```

### List Products

```http
GET /v1/products/search?page_number={n}&page_size={size}
```

**Query Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `page_number` | number | No | Page number (default: 1) |
| `page_size` | number | No | Items per page |

**Response: ProductListEntity**

```json
{
  "items": [ /* ProductEntity[] */ ],
  "pagination": {
    "total_records": 25,
    "total_pages": 3,
    "current_page": 1,
    "next_page": 2,
    "prev_page": null
  }
}
```

---

## Customers API

### Retrieve Customer

```http
GET /v1/customers?customer_id={id}
GET /v1/customers?email={email}
```

Retrieve by ID or email (provide one, not both).

**Response: CustomerEntity**

```json
{
  "id": "cust_abc123",
  "mode": "test",
  "object": "customer",
  "email": "user@example.com",
  "name": "John Doe",
  "country": "US",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### List Customers

```http
GET /v1/customers/list?page_number={n}&page_size={size}
```

### Generate Customer Portal Link

```http
POST /v1/customers/billing
```

**Request Body:**

```json
{
  "customer_id": "cust_abc123"
}
```

**Response:**

```json
{
  "customer_portal_link": "https://creem.io/portal/cust_abc123?token=..."
}
```

---

## Subscriptions API

### Retrieve Subscription

```http
GET /v1/subscriptions?subscription_id={id}
```

**Response: SubscriptionEntity**

```json
{
  "id": "sub_abc123",
  "mode": "test",
  "object": "subscription",
  "status": "active",
  "product": { /* ProductEntity */ },
  "customer": { /* CustomerEntity */ },
  "items": [
    {
      "id": "sitem_xyz789",
      "object": "subscription_item",
      "product_id": "prod_abc123",
      "price_id": "pprice_123",
      "units": 5,
      "mode": "test"
    }
  ],
  "collection_method": "charge_automatically",
  "last_transaction_id": "tran_xyz789",
  "last_transaction_date": "2024-01-01T00:00:00Z",
  "next_transaction_date": "2024-02-01T00:00:00Z",
  "current_period_start_date": "2024-01-01T00:00:00Z",
  "current_period_end_date": "2024-02-01T00:00:00Z",
  "canceled_at": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Subscription Statuses:**
- `active` - Currently active and paid
- `trialing` - In trial period
- `paused` - Temporarily paused
- `canceled` - Canceled (terminal)
- `unpaid` - Payment failed
- `scheduled_cancel` - Will cancel at period end

### Update Subscription

```http
POST /v1/subscriptions/{id}
```

**Request Body:**

```json
{
  "items": [
    {
      "id": "sitem_xyz789",
      "units": 10
    }
  ],
  "update_behavior": "proration-charge-immediately"
}
```

**Update Behaviors:**
- `proration-charge-immediately` - Charge prorated amount now, new billing cycle starts
- `proration-charge` - Credit added to next invoice, same billing cycle
- `proration-none` - No proration, change at next cycle

### Upgrade Subscription

```http
POST /v1/subscriptions/{id}/upgrade
```

**Request Body:**

```json
{
  "product_id": "prod_premium",
  "update_behavior": "proration-charge-immediately"
}
```

### Cancel Subscription

```http
POST /v1/subscriptions/{id}/cancel
```

**Request Body:**

```json
{
  "mode": "scheduled",
  "onExecute": "cancel"
}
```

**Options:**
- `mode`: `immediate` (cancel now) or `scheduled` (at period end)
- `onExecute`: `cancel` or `pause` (only for scheduled mode)

### Pause Subscription

```http
POST /v1/subscriptions/{id}/pause
```

No request body required.

### Resume Subscription

```http
POST /v1/subscriptions/{id}/resume
```

No request body required.

---

## Licenses API

### Activate License

```http
POST /v1/licenses/activate
```

**Request Body:**

```json
{
  "key": "ABC123-XYZ456-XYZ456-XYZ456",
  "instance_name": "johns-macbook-pro"
}
```

**Response: LicenseEntity**

```json
{
  "id": "lic_abc123",
  "mode": "test",
  "object": "license",
  "status": "active",
  "key": "ABC123-XYZ456-XYZ456-XYZ456",
  "activation": 1,
  "activation_limit": 3,
  "expires_at": "2025-01-01T00:00:00Z",
  "created_at": "2024-01-01T00:00:00Z",
  "instance": {
    "id": "inst_xyz789",
    "mode": "test",
    "object": "license-instance",
    "name": "johns-macbook-pro",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**License Statuses:**
- `active` - Valid and usable
- `inactive` - No activations yet
- `expired` - Past expiration date
- `disabled` - Manually disabled

### Validate License

```http
POST /v1/licenses/validate
```

**Request Body:**

```json
{
  "key": "ABC123-XYZ456-XYZ456-XYZ456",
  "instance_id": "inst_xyz789"
}
```

### Deactivate License

```http
POST /v1/licenses/deactivate
```

**Request Body:**

```json
{
  "key": "ABC123-XYZ456-XYZ456-XYZ456",
  "instance_id": "inst_xyz789"
}
```

---

## Discounts API

### Create Discount

```http
POST /v1/discounts
```

**Request Body:**

```json
{
  "name": "Holiday Sale",
  "code": "HOLIDAY2024",
  "type": "percentage",
  "percentage": 20,
  "duration": "repeating",
  "duration_in_months": 6,
  "max_redemptions": 100,
  "expiry_date": "2024-12-31T23:59:59Z",
  "applies_to_products": ["prod_abc123", "prod_xyz456"]
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name |
| `code` | string | No | Discount code (auto-generated if empty) |
| `type` | string | Yes | `percentage` or `fixed` |
| `percentage` | number | If type=percentage | Discount percentage (e.g., 20 for 20%) |
| `amount` | number | If type=fixed | Fixed amount in cents |
| `currency` | string | If type=fixed | Currency for fixed discount |
| `duration` | string | Yes | `forever`, `once`, or `repeating` |
| `duration_in_months` | number | If duration=repeating | Months to apply |
| `max_redemptions` | number | No | Usage limit |
| `expiry_date` | string | No | ISO date when code expires |
| `applies_to_products` | array | Yes | Product IDs this applies to |

**Response: DiscountEntity**

```json
{
  "id": "dis_abc123",
  "mode": "test",
  "object": "discount",
  "status": "active",
  "name": "Holiday Sale",
  "code": "HOLIDAY2024",
  "type": "percentage",
  "percentage": 20,
  "duration": "repeating",
  "duration_in_months": 6,
  "max_redemptions": 100,
  "expiry_date": "2024-12-31T23:59:59Z",
  "applies_to_products": ["prod_abc123"],
  "redeem_count": 15
}
```

### Retrieve Discount

```http
GET /v1/discounts?discount_id={id}
GET /v1/discounts?discount_code={code}
```

### Delete Discount

```http
DELETE /v1/discounts/{id}/delete
```

---

## Transactions API

### Get Transaction

```http
GET /v1/transactions?transaction_id={id}
```

**Response: TransactionEntity**

```json
{
  "id": "tran_abc123",
  "mode": "test",
  "object": "transaction",
  "amount": 2900,
  "amount_paid": 3509,
  "discount_amount": 0,
  "currency": "USD",
  "type": "invoice",
  "tax_country": "US",
  "tax_amount": 609,
  "status": "paid",
  "refunded_amount": null,
  "order": "ord_xyz789",
  "subscription": "sub_abc123",
  "customer": "cust_xyz789",
  "description": "Subscription payment",
  "period_start": 1704067200000,
  "period_end": 1706745600000,
  "created_at": 1704067200000
}
```

**Transaction Types:**
- `payment` - One-time payment
- `invoice` - Subscription payment

**Transaction Statuses:**
- `paid` - Successfully paid
- `refunded` - Fully refunded
- `partially_refunded` - Partially refunded
- `chargeback` - Disputed

### List Transactions

```http
GET /v1/transactions/search
```

**Query Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer_id` | string | No | Filter by customer |
| `order_id` | string | No | Filter by order |
| `product_id` | string | No | Filter by product |
| `page_number` | number | No | Page number |
| `page_size` | number | No | Items per page |

---

## Common Entities

### OrderEntity

```json
{
  "id": "ord_abc123",
  "mode": "test",
  "object": "order",
  "customer": "cust_xyz789",
  "product": "prod_abc123",
  "transaction": "tran_xyz789",
  "discount": "dis_abc123",
  "amount": 2900,
  "sub_total": 2900,
  "tax_amount": 609,
  "discount_amount": 0,
  "amount_due": 3509,
  "amount_paid": 3509,
  "currency": "USD",
  "status": "paid",
  "type": "recurring",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### PaginationEntity

```json
{
  "total_records": 100,
  "total_pages": 10,
  "current_page": 1,
  "next_page": 2,
  "prev_page": null
}
```

### EnvironmentMode

Values: `test`, `prod`, `sandbox`

---

## HTTP Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing API key |
| 403 | Forbidden - Invalid API key or limit reached |
| 404 | Not Found - Resource doesn't exist |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Rate Limits

Contact support for specific rate limits. Implement exponential backoff for 429 responses.

## Idempotency

Use `request_id` for checkout sessions to prevent duplicate payments if retrying failed requests.
