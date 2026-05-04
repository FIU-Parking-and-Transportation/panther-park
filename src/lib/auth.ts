import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { Pool } from "pg";

export const auth = betterAuth({
  appName: "Panther Park",

  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
  },

  advanced: {
    database: {
      generateId: () => Bun.randomUUIDv7(),
    },
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    apiKey(),
  ],
});

export type Session = typeof auth.$Infer.Session;
