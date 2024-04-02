import App from "./app.js";
import DatabaseMigrator from "./db/index.js";

const app = new App();

try {
  if (process.env.MIGRATE === "true") {
    const databaseMigrator = new DatabaseMigrator(process.env.DATABASE_URL!);
    await databaseMigrator.migrate();
  }
  app.listen();
} catch (error: Error | unknown) {
  console.error(
    `Error starting server: ${(error as Error)?.message as string}`
  );
}
