# Strapi 5 Plugin for Creem

A [Strapi 5](https://strapi.io/) plugin to manage **[Creem](https://creem.io) products and subscriptions** from the admin panel, and to offer a **simple front-end checkout** using a small **JavaScript snippet** (content API).

## Table of Contents

- [Installation](#installation)
- [Environment variables (`.env`)](#environment-variables-env)
- [Webhooks (signature verification)](#webhooks-signature-verification)
- [Configuration (admin)](#configuration-admin)
- [Managing products](#managing-products)
- [Embed checkout button (snippet)](#embed-checkout-button-snippet)
- [License](#license)

## Installation

1. Add the plugin to your Strapi project:

```bash
npm i strapi5-plugin-for-creem
```

2. Restart Strapi:

```bash
npm run develop
```

## Environment variables (`.env`)

The plugin talks to **Creem's REST API** with an **API key** (`x-api-key` header) and verifies **webhook signatures** using HMAC-SHA256.

### Required (per environment you use)

| Variable | Description |
| -------- | ----------- |
| `STRAPI_CREEM_TEST_API_KEY` | Creem **test mode** API key (`https://test-api.creem.io/v1`). Toggle Test Mode in the [Creem dashboard](https://creem.io/dashboard). |
| `STRAPI_CREEM_API_KEY` | Creem **production** API key (`https://api.creem.io/v1`). |

You only need the key for the environment(s) you actually use. The admin **Settings** screen reflects which keys are present.

### Webhooks (optional but recommended for event forwarding)

| Variable | Description |
| -------- | ----------- |
| `STRAPI_CREEM_WEBHOOK_SECRET` | Webhook secret from Creem **Developers → Webhook**. Required for the plugin to verify incoming webhooks. |

### Example `.env` in your Strapi project

```env
# Creem API (use test and/or production depending on your setup)
STRAPI_CREEM_TEST_API_KEY="creem_test_..."
STRAPI_CREEM_API_KEY="creem_..."

# Webhook verification (signing secret from Creem dashboard)
STRAPI_CREEM_WEBHOOK_SECRET="..."
```

## Webhooks (signature verification)

The plugin receives Creem webhook events, **verifies the `creem-signature` header** (HMAC-SHA256), and optionally **forwards the parsed JSON payload** to your own URL (configured in admin as **Webhook forward URL**).

> The plugin does **not** implement your business logic for each event type. It **authenticates** the request and can **forward** the parsed event to your API.

See the [Creem webhooks guide](https://docs.creem.io/code/webhooks) for supported events (`checkout.completed`, `subscription.*`, `refund.created`, etc.).

### Webhook endpoint URL

When you register the webhook in Creem, use a **public HTTPS** URL:

`https://your-deployed-strapi-instance.com/api/strapi5-plugin-for-creem/webhook`

- Method: **POST**
- Respond with **HTTP 200** on success (Creem retries on other status codes).

### Local development

Use a tunnel (ngrok, Cloudflare Tunnel, etc.) to expose local Strapi:

```bash
ngrok http 1337
```

Register: `https://abcd.ngrok.io/api/strapi5-plugin-for-creem/webhook`

## Configuration (admin)

In the Strapi admin:

1. Open **Settings → Creem → Configuration**.
2. Configure:
   - **Environment**: Test mode vs Production (constrained by which API keys are set in `.env`).
   - **Checkout success URL**: optional default used when checkout requests do not pass a URL.
   - **Webhook forward URL** (optional): after verification, the plugin **POST**s the event JSON to this URL.

## Managing products

From the plugin admin page (**Plugins → Strapi 5 Plugin for Creem**) you can:

- **Create** Creem products (one-time or subscription, including free products with price `0`) via the [Creem Products API](https://docs.creem.io/api-reference/endpoint/create-product).
- **List** products from your Creem store (archived products are excluded).
- Configure **currency** (USD or EUR) when creating a product.
- Attach **license keys** and **private notes** as product features on create.
- **Edit** or **archive** products by opening the [Creem dashboard](https://www.creem.io/dashboard) (`https://www.creem.io/dashboard/products/edit/{productId}`). The Creem API does not support these operations via this plugin yet.
- Generate an **embed snippet** for front-end checkout.

This plugin is a **thin UI + API bridge** to Creem.

## Embed checkout button (snippet)

The admin UI shows an **embed snippet** that posts to your Strapi **content API** checkout route:

`POST /api/strapi5-plugin-for-creem/checkout`

The snippet uses `data-creem-checkout` attributes (product id, email, optional success URL, metadata). The server creates a [Creem checkout session](https://docs.creem.io/api-reference/endpoint/create-checkout) and returns `{ "url": "..." }` with the Creem checkout URL.

## License

MIT
