"use client";

import { createCreemAuthClient } from "../../../../dist/create-creem-auth-client.mjs";
import { creemClient } from "../../../../dist/client.mjs";

export const authClient = createCreemAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  plugins: [creemClient()],
});
