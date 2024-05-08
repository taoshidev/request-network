import DatabaseMigrator from "./migrator";
import * as dotenv from "dotenv";
dotenv.config();

const migrator = new DatabaseMigrator(process.env.DATABASE_URL!);
migrator
  .migrate()
  .catch((err) => console.error("Failed to complete migrations...", err));
