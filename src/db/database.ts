import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export default class Database {
  public static client = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
  });

  private static _drizzle: PostgresJsDatabase<typeof schema>;

  public static get db() {
    if (!this._drizzle) {
      this._drizzle = drizzle(Database.client, { schema });
    }
    return this._drizzle;
  }
}
