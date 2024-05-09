import * as dotenv from "dotenv";
import * as path from "path";
const nodeEnv = process.env.NODE_ENV || 'development';
const basePath = path.join(__dirname, "..", ".env");
const envPath = basePath + (nodeEnv === "development" ? "" : "." + nodeEnv);
dotenv.config({ path: envPath });
import App from "./app";
import DatabaseMigrator from "./db/migrator";
import Logger from "./utils/logger";

const app = new App();

(async () => {
  try {
    app.init(async (app: App) => {
      Logger.info(`Application loading environment variables from ${envPath}...`);
      if (process.env.DATABASE_URL && process.env.MIGRATE === "true") {
        const databaseMigrator = new DatabaseMigrator(
          process.env.DATABASE_URL!
        );
        await databaseMigrator.migrate();
      }
    });
  } catch (error) {
    Logger.error(`Error starting server: ${(error as Error)?.message}`);
  }
})();
