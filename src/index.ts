import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
import App from "./app";
import DatabaseMigrator from "./db/migrator";

const app = new App();

(async () => {
  try {
    app.init(async (app: App) => {
      if (process.env.DATABASE_URL && process.env.MIGRATE === "true") {
        const databaseMigrator = new DatabaseMigrator(
          process.env.DATABASE_URL!
        );
        await databaseMigrator.migrate();
      }
    });
  } catch (error) {
    console.error(`Error starting server: ${(error as Error)?.message}`);
  }
})();
