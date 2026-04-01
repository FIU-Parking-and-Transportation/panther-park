import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  extensionsFilters: ["postgis"],
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
