import cors from "cors";
import { Request, Response, NextFunction, RequestHandler } from "express";
import Database from "../db/database.js";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { ServiceDTO } from "..//db/dto/service-dto.js";
import Logger from "../utils/logger.js";

/**
 * The Cors class manages CORS (Cross-Origin Resource Sharing) policies for the application,
 * allowing or blocking requests based on their origin. It supports dynamic updating of the
 * whitelist based on entries in a database, enabling live updates to the CORS policy without
 * restarting the application.
 *
 * Usage:
 *   - Import the Cors class.
 *   - Use Cors.getDynamicCorsMiddleware() as a middleware in your Express application to apply the CORS policy.
 *
 * Example:
 * ```javascript
 * import express from 'express';
 * import Cors from './Cors';
 *
 * const app = express();
 * app.use(Cors.getDynamicCorsMiddleware());
 * ```
 *
 * The class automatically initializes itself, fetching the initial whitelist from the database
 * and setting up a refresh interval to update the whitelist periodically.
 */
export default class Cors {
  protected static db: PostgresJsDatabase<typeof schema> = Database.db;
  public static cachedWhitelist: string[] = [];
  private static lastFetchTime: number = Date.now();
  private static intervalId: NodeJS.Timeout | null = null;

  public static async init() {
    if (this.intervalId) clearInterval(this.intervalId);
    await this.refreshWhitelist();
    this.intervalId = setInterval(
      this.refreshWhitelist.bind(this),
      process.env.NODE_ENV === "development" ? 60 * 1000 : 60 * 60 * 1000
    );
  }

  private static async refreshWhitelist(): Promise<void> {
    try {
      const newWhitelist = await this.getWhitelistFromDb();
      const uniqueWhitelist = new Set([
        process.env.REQUEST_NETWORK_UI_URL as string,
        `${process.env.API_HOST}:${process.env.API_PORT}`,
        ...newWhitelist,
      ]);
      this.cachedWhitelist = Array.from(uniqueWhitelist).filter(Boolean);
      this.lastFetchTime = Date.now();
      Logger.info(`Updated CORS whitelist: ${this.cachedWhitelist}`);
    } catch (error) {
      Logger.error(`Failed to refresh whitelist: ${error}`);
    }
  }

  private static async getWhitelistFromDb(): Promise<string[]> {
    const res = (
      await this.db
        .select({
          consumerApiUrl: schema.services.consumerApiUrl,
          meta: schema?.services?.meta,
        })
        .from(schema.services)
        .where(eq(schema.services.type, "consumer"))
    ).map(({ consumerApiUrl, meta }) => ({
      consumerApiUrl: consumerApiUrl ?? undefined,
      meta: meta as unknown,
    })) as Pick<ServiceDTO, "consumerApiUrl" | "meta">[];

    if (res) {
      const urlsArray = res.flatMap((item: ServiceDTO) =>
        [item.consumerApiUrl, item?.meta?.endpoint].filter(
          (url): url is string => url !== undefined
        )
      );
      return urlsArray;
    }
    return [];
  }

  public static getDynamicCorsMiddleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const origin = req.header("Origin") as string;
      const allowed = this.cachedWhitelist.includes(origin);
      const keys = [
        "x-taoshi-consumer-request-key",
        "x-taoshi-request-key",
        "x-taoshi-validator-request-key",
      ].some((key) => req.headers[key.toLowerCase()] !== undefined);

      if ((!origin && keys) || allowed) {
        const corsOptions = {
          origin: allowed,
          credentials: true,
          methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
          allowedHeaders: "Content-Type, Authorization",
        };
        return cors(corsOptions)(req, res, next);
      }
      Logger.info(`Origin not allowed: ${origin}`);
      return res.status(403).json({ error: "Not allowed" });
    };
  }
}

// Initialize the CORS whitelist refresh cycle
Cors.init();
