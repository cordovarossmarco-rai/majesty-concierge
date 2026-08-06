import type { Config } from "drizzle-kit";
import { existsSync } from "node:fs";

// drizzle-kit runs outside Next, so it does not pick up .env.local on its own.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
