import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema.js";

export default class DatabaseMigrator {
  private connectionString: string;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined");
    }
    this.connectionString = connectionString;
  }
  async migrate(): Promise<void> {
    if(process.env.MIGRATE==='false') return;
    console.log(process.env.DATABASE_URL);
    const client = postgres(this.connectionString, { prepare: false });
    const migrationClient = postgres(this.connectionString, { prepare: false });
    const db = drizzle(client, { schema });
    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    await migrationClient.end();
    await client.end();
  }
}
