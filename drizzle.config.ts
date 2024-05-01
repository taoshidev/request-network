import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
import * as path from "path";
const nodeEnv = process.env.NODE_ENV || 'development';
const basePath = path.join(__dirname, ".env");
const envPath = basePath + (nodeEnv === "development" ? "" : "." + nodeEnv);
dotenv.config({ path: envPath });
import Logger from "./src/utils/logger";

Logger.info(`Database loading environment variables from ${envPath}...`);
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required.");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
} satisfies Config;
