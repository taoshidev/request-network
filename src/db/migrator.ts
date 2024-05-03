import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema";
import Logger from "../utils/logger";

export default class DatabaseMigrator {
  private connectionString: string;

  constructor(connectionString: string = process.env.DATABASE_URL!) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined");
    }
    this.connectionString = connectionString;
  }

  async migrate(): Promise<void> {
    if (process.env.MIGRATE === "false") {
      Logger.info("Migration skipped because the MIGRATE environment variable is set to 'false'.");
      return;
    }

    try {
      const client = postgres(this.connectionString, { prepare: false });
      const db = drizzle(client, { schema });

      Logger.info("Running migrations...");
      await migrate(db, { migrationsFolder: "src/db/migrations" });

      await client.end();
      Logger.info("Migrations completed successfully.");
    } catch (error) {
      Logger.error(`Failed to execute migrations: ${error}`);
      throw error;
    }
  }
}
