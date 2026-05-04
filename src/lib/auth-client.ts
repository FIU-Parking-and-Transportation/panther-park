import { createAuthClient } from "better-auth/svelte";
import { adminClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";

export const authClient = createAuthClient({
  plugins: [adminClient(), apiKeyClient()],
});

export type AuthClient = typeof authClient;
