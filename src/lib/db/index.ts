import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

// Pass the connection string directly; drizzle-orm/bun-sql creates its own
// Bun SQL client internally using this URL.
export const db = drizzle(process.env.DATABASE_URL as string, { schema });

export type Database = typeof db;
