import type { WebhookEventEntity } from "./models/components/webhookevententity.js";
import { webhookEventEntityFromJSON } from "./models/components/webhookevententity.js";

export type WebhookHeaders =
  | Headers
  | Iterable<[string, string]>
  | Record<string, string | string[] | undefined>;

export type WebhookSecretOptions = {
  secret: string;
  toleranceInSeconds?: number;
};

export type CreemWebhookPayload<TData = unknown> = {
  id?: string;
  created_at?: number;
  type?: string;
  eventType?: string;
  data?: TData;
  object?: TData;
};

export type CreemWebhookEvent<TData = unknown> = {
  type: string;
  data: TData;
  raw: CreemWebhookPayload<TData>;
  id?: string;
  createdAt?: number;
};

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

const defaultToleranceInSeconds = 5 * 60;

const textEncoder = new TextEncoder();

const payloadToString = (payload: string | ArrayBuffer | Uint8Array) => {
  if (typeof payload === "string") {
    return payload;
  }
  const bytes = payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload;
  return new TextDecoder().decode(bytes);
};

const normalizeHeaders = (headers: WebhookHeaders) => {
  const normalized: Record<string, string> = {};
  const setHeader = (key: string, value: string | string[] | undefined) => {
    if (value === undefined) return;
    normalized[key.toLowerCase()] = Array.isArray(value) ? value[0] ?? "" : value;
  };

  if ("forEach" in headers && typeof headers.forEach === "function") {
    headers.forEach((value, key) => setHeader(key, value));
    return normalized;
  }

  if (Symbol.iterator in headers) {
    for (const [key, value] of headers) {
      setHeader(key, value);
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(headers)) {
    setHeader(key, value);
  }
  return normalized;
};

const normalizeSecretOptions = (
  options: string | WebhookSecretOptions,
): Required<WebhookSecretOptions> => ({
  secret: typeof options === "string" ? options : options.secret,
  toleranceInSeconds:
    typeof options === "string"
      ? defaultToleranceInSeconds
      : options.toleranceInSeconds ?? defaultToleranceInSeconds,
});

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const toBase64 = (bytes: Uint8Array) => {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
};

const fromBase64 = (value: string) => {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(value, "base64"));
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const hmacSha256 = async (keyBytes: Uint8Array, value: string) => {
  if (!globalThis.crypto?.subtle) {
    throw new WebhookVerificationError("Web Crypto is not available");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      toArrayBuffer(textEncoder.encode(value)),
    ),
  );
};

const normalizeLegacySignature = (signature: string) => {
  const trimmed = signature.trim();
  return trimmed.startsWith("sha256=")
    ? trimmed.slice("sha256=".length).toLowerCase()
    : trimmed.toLowerCase();
};

const verifyTimestamp = (timestampHeader: string, toleranceInSeconds: number) => {
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (Number.isNaN(timestamp)) {
    throw new WebhookVerificationError("Invalid webhook timestamp");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > toleranceInSeconds) {
    throw new WebhookVerificationError("Webhook timestamp is too old");
  }
  if (timestamp > now + toleranceInSeconds) {
    throw new WebhookVerificationError("Webhook timestamp is too new");
  }
  return timestamp;
};

const verifyStandardWebhook = async (
  payload: string,
  headers: Record<string, string>,
  { secret, toleranceInSeconds }: Required<WebhookSecretOptions>,
) => {
  const id = headers["webhook-id"];
  const timestampHeader = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];

  if (!id || !timestampHeader || !signatureHeader) {
    return false;
  }

  const timestamp = verifyTimestamp(timestampHeader, toleranceInSeconds);
  const secretValue = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const expected = toBase64(
    await hmacSha256(fromBase64(secretValue), `${id}.${timestamp}.${payload}`),
  );

  for (const versionedSignature of signatureHeader.split(" ")) {
    const [version, signature] = versionedSignature.split(",");
    if (version === "v1" && signature && timingSafeEqual(signature, expected)) {
      return true;
    }
  }

  throw new WebhookVerificationError("Invalid webhook signature");
};

const verifyLegacyWebhook = async (
  payload: string,
  headers: Record<string, string>,
  secret: string,
) => {
  const signature = headers["creem-signature"] ?? headers["x-creem-signature"];
  if (!signature) {
    throw new WebhookVerificationError("Missing webhook signature");
  }

  const expected = toHex(await hmacSha256(textEncoder.encode(secret), payload));
  if (!timingSafeEqual(normalizeLegacySignature(signature), expected)) {
    throw new WebhookVerificationError("Invalid webhook signature");
  }
};

export const verifyWebhookSignature = async (
  payload: string | ArrayBuffer | Uint8Array,
  headers: WebhookHeaders,
  options: string | WebhookSecretOptions,
) => {
  const payloadString = payloadToString(payload);
  const normalizedHeaders = normalizeHeaders(headers);
  const normalizedOptions = normalizeSecretOptions(options);

  if (await verifyStandardWebhook(payloadString, normalizedHeaders, normalizedOptions)) {
    return;
  }

  await verifyLegacyWebhook(payloadString, normalizedHeaders, normalizedOptions.secret);
};

export const parseWebhookEvent = <TData = unknown>(
  payload: string | ArrayBuffer | Uint8Array,
): CreemWebhookEvent<TData> => {
  const raw = JSON.parse(payloadToString(payload)) as CreemWebhookPayload<TData>;
  const type = raw.type ?? raw.eventType;
  if (!type) {
    throw new Error("Invalid webhook payload: missing event type");
  }

  const event: CreemWebhookEvent<TData> = {
    type,
    data: (raw.data ?? raw.object) as TData,
    raw,
  };
  if (raw.id) event.id = raw.id;
  if (raw.created_at) event.createdAt = raw.created_at;
  return event;
};

export const parseWebhookEventEntity = (
  payload: string | ArrayBuffer | Uint8Array,
): WebhookEventEntity => {
  const result = webhookEventEntityFromJSON(payloadToString(payload));
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
};

export const constructWebhookEvent = async <TData = unknown>(
  payload: string | ArrayBuffer | Uint8Array,
  headers: WebhookHeaders,
  options: string | WebhookSecretOptions,
) => {
  await verifyWebhookSignature(payload, headers, options);
  return parseWebhookEvent<TData>(payload);
};

export const constructWebhookEventEntity = async (
  payload: string | ArrayBuffer | Uint8Array,
  headers: WebhookHeaders,
  options: string | WebhookSecretOptions,
): Promise<WebhookEventEntity> => {
  await verifyWebhookSignature(payload, headers, options);
  return parseWebhookEventEntity(payload);
};
