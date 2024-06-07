import "./instrument";
import express, { Express, Request, Response } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { services, transactions } from "./db/schema";
import BaseController from "./core/base.controller";
import BaseRouter from "./core/base.router";
import ConsumerRoute from "./router/consumer.router";
import Cors from "./core/cors";
import Logger from "./utils/logger";
import UiRequest from "./auth/ui-request";
import DynamicRouter from "./core/dynamic.router";
import ConsumerRequest from "./auth/consumer-request";
import ServiceCron from "./core/cron";
import Registration from "./core/registration";
import UpholdConnector from "./service/uphold.connector";
import TransactionManager from "./service/transaction.manager";
import ConsumerCtrl from "./controller/consumer.controller";
import PaymentRoute from "./router/payment.router";
import PaymentCtrl from "./controller/payment.controller";

export default class App {
  public express: Express;
  private apiPrefix: string;

  constructor() {
    this.express = express();
    this.apiPrefix = process.env.API_PREFIX || "/api/v1";
  }

  private async monitorBlockchainTransactions() {
    // Run the monthly service cron 1st of every month
    ServiceCron.getInstance().run();
    // Monitor pending transactions on USDC and USDT
    TransactionManager.getInstance().startMonitoring();
  }

  private async initializeUpholdConnector(): Promise<void> {
    // Authenticate with Uphold API service
    const uphold = await new UpholdConnector().authenticate();
    // Create Uphold cards if not exists
    ["TAO", "USDC", "USDT"].forEach(
      async (currency) =>
        await uphold.checkCardExistsOrCreate(await uphold.getCards(), currency)
    );
  }

  private async initializeMiddlewares(): Promise<void> {
    this.express.use(helmet());
    this.express.use(
      express.json({
        verify: (req, res, buf) => {
          // set rawBody in request only for stripe webhook requests
          if ((req as any).originalUrl.startsWith("/webhooks")) {
            (req as any).rawBody = buf.toString();
          }
        },
      })
    );

    this.express.use(express.urlencoded({ extended: false }));
  }

  private initializeStaticRoutes(): void {
    this.express.use(express.static(path.join(__dirname, "public")));
    this.express.set("view engine", "ejs");
    this.express.set("views", path.join(__dirname, "views"));
    this.express.get("/", (req, res) => {
      res.setHeader("Origin-Agent-Cluster", "?1");
      res.render("index", {
        uiAppUrl: process.env.REQUEST_NETWORK_UI_URL,
        validatorName: process.env.VALIDATOR_NAME || "",
      });
    });
    this.express.get("/subscribe", (req, res) => {
      res.setHeader("Origin-Agent-Cluster", "?1");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self' data: ; script-src 'self' https://js.stripe.com; connect-src 'self' https://api.stripe.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; img-src 'self' https://*.stripe.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
      );
      res.render("subscribe", {
        api: btoa(process.env.API_HOST || ""),
        key: btoa(process.env.STRIPE_PUBLIC_KEY || ""),
        uiAppUrl: process.env.REQUEST_NETWORK_UI_URL || "",
        validatorName: process.env.VALIDATOR_NAME || "",
      });
    });
    this.express.get("/subscribe", (req, res) => {
      res.setHeader("Origin-Agent-Cluster", "?1");
      res.setHeader("Content-Security-Policy", "default-src 'self' data: ; script-src 'self' https://js.stripe.com; connect-src 'self' https://api.stripe.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; img-src 'self' https://*.stripe.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;")
      res.render("subscribe", {
        api: btoa(process.env.API_HOST || ''),
        key: btoa(process.env.STRIPE_PUBLIC_KEY || ''),
        uiAppUrl: process.env.REQUEST_NETWORK_UI_URL || ''
      });
    });
  }

  private initializeHealthCheck(): void {
    this.express.get("/health", cors(), (req: Request, res: Response) => {
      res.status(200).json({
        uptime: process.uptime(),
        message: "Ok",
        date: new Date(),
      });
    });
  }

  private initializeRoutes(): void {
    this.express.use(Cors.getDynamicCorsMiddleware());
    this.express.use(new ConsumerRoute(new ConsumerCtrl()).routes());
    this.express.use(new PaymentRoute(new PaymentCtrl()).routes());

    // Loop through all the schema and mount their routes
    // In case there are more than 1 schema, we will loop through them
    [transactions, services].forEach((schema) => {
      const ctrl = new BaseController(schema);
      this.express.use(
        `${this.apiPrefix}/${ctrl.tableName.toLowerCase()}`,
        new BaseRouter(schema, ctrl, UiRequest.interceptor).mount()
      );
    });

    // Setup dynamic routes
    this.express.use(
      "/",
      new DynamicRouter(ConsumerRequest.interceptor).mount()
    );

    if (process.env.NODE_ENV !== "production") {
      this.printRoutes(this.express._router);
    }
  }

  private initializeSentry(): void {
    // The error handler must be registered before any other error middleware and after all controllers
    if (process.env.SENTRY_DSN) {
      Sentry.setupExpressErrorHandler(this.express);
    }
  }

  private initializeErrorHandling(): void {
    this.express.use((req, res, next) => {
      res.status(404).send("The resource requested cannot be found!");
    });

    this.express.use(
      (err: any, req: Request, res: Response, next: Function) => {
        process.env.NODE_ENV !== "production" && Logger.error(err.stack);
        const statusCode = err.statusCode || 500;
        const errorMessage = err.message || "Internal Server Error";
        return res.status(statusCode).json({ error: errorMessage });
      }
    );
  }

  public printRoutes(router: express.Router) {
    router?.stack?.forEach((middleware) => {
      if (middleware.route) {
        // Routes registered directly on the app
        const { path, stack } = middleware.route;
        stack?.forEach((stackItem: any) => {
          Logger.info(`${stackItem?.method?.toUpperCase()} ${path}`);
        });
      } else if (middleware.name === "router") {
        // Routes added as router middleware
        middleware.handle.stack?.forEach((handler: any) => {
          const route = handler.route;
          route &&
            route.stack?.forEach((routeStack: any) => {
              Logger.info(`${routeStack?.method?.toUpperCase()} ${route.path}`);
            });
        });
      }
    });
  }

  public init(cb: (app: App) => void): App {
    Logger.info("Initializing app...");

    this.initializeMiddlewares();
    this.initializeHealthCheck();

    if (
      process.env.INFURA_PROJECT_ID &&
      (!process.env.ROLE || process.env.ROLE === "cron_handler")
    ) {
      this.monitorBlockchainTransactions();

      if (process.env.ROLE === "cron_handler") {
        this.startServer(cb, "Running in cron mode.");
        return this;
      }
    }

    if (!process.env.ROLE || process.env.ROLE !== "cron_handler") {
      Cors.init();
      this.initializeStaticRoutes();
      this.initializeRoutes();
      Registration.registerWithUI();

      if (process.env.UPHOLD_CLIENT_ID && process.env.UPHOLD_CLIENT_SECRET) {
        this.initializeUpholdConnector();
      }
    }

    this.initializeSentry();
    this.initializeErrorHandling();
    this.startServer(cb, "Running in validator mode.");
    return this;
  }

  private startServer(cb: (app: App) => void, message?: string): void {
    const port: number | string = process.env.API_PORT || 8080;
    this.express.listen(port, () => {
      Logger.info(
        `Server running at ${process.env.API_HOST}... Server Role: ${process.env.ROLE || "validator"
        } ${message || ""}`
      );
      cb?.(this);
    });
  }
}