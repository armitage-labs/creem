"use client";

import { createCreemAuthClient } from "../../../../dist/esm/create-creem-auth-client";
import { creemClient } from "../../../../dist/esm/client";

export const authClient = createCreemAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  plugins: [creemClient()],
});
