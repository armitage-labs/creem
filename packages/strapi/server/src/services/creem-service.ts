import type { Core } from "@strapi/strapi";
import axios, { type AxiosRequestConfig, type Method } from "axios";

export type CreemEnvironment = "test" | "production";

const BASE_URLS: Record<CreemEnvironment, string> = {
  test: "https://test-api.creem.io/v1",
  production: "https://api.creem.io/v1",
};

function getApiKey(env: CreemEnvironment): string {
  const key =
    env === "production" ? process.env.STRAPI_CREEM_API_KEY : process.env.STRAPI_CREEM_TEST_API_KEY;
  if (!key) {
    throw new Error(
      `Missing Creem API key for ${env} (set STRAPI_CREEM_${env === "production" ? "API" : "TEST_API"}_KEY)`,
    );
  }
  return key;
}

async function creemHttpRequest<T>(
  env: CreemEnvironment,
  baseURL: string,
  method: Method,
  path: string,
  config?: Omit<AxiosRequestConfig, "url" | "method" | "baseURL">,
): Promise<T> {
  const apiKey = getApiKey(env);
  const res = await axios.request<T>({
    ...config,
    method,
    baseURL,
    url: path.startsWith("/") ? path : `/${path}`,
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      ...config?.headers,
    },
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    const data = res.data as { message?: string; error?: string; trace_id?: string };
    const detail = data?.message ?? data?.error ?? res.statusText;
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    (err as Error & { status?: number; payload?: unknown }).status = res.status;
    (err as Error & { payload?: unknown }).payload = res.data;
    throw err;
  }
  return res.data;
}

export default (_ctx: { strapi: Core.Strapi }) => ({
  getBaseUrl(env: CreemEnvironment): string {
    return BASE_URLS[env];
  },
  getApiKey,
  async creemRequest<T = unknown>(
    env: CreemEnvironment,
    method: Method,
    path: string,
    config?: Omit<AxiosRequestConfig, "url" | "method" | "baseURL">,
  ): Promise<T> {
    return creemHttpRequest<T>(env, BASE_URLS[env], method, path, config);
  },
});
