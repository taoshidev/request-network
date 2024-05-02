import express, { Express, Request, Response } from "express";
import helmet from "helmet";
import path from "path";
import { services, wallets } from "./db/schema";
import BaseController from "./core/base.controller";
import BaseRouter from "./core/base.router";
import ConsumerCtrl from "./controller/consumer.controller";
import ConsumerRoute from "./router/consumer.router";
import Cors from "./core/cors";
import Logger from "./utils/logger";
import UiRequest from "./auth/ui-request";
import DynamicRouter from "./core/dynamic.router";
import ConsumerRequest from "./auth/consumer-request";
import BlockchainManager from "./service/blockchain.manager";
import ServiceCron from "./core/cron";
import Registration from "./core/registration";
import UpholdConnector from "./service/uphold.connector";
import TransactionManager from "./service/transaction.manager";

export default class App {
  public express: Express;
  private apiPrefix: string;

  constructor() {
    this.express = express();
    this.apiPrefix = process.env.API_PREFIX || "/api/v1";
  }

  private async monitorBlockchainTransactions() {
    // Run the monthly service cron 1st of every month
    new ServiceCron().run();
    // Monitor pending transactions on USDC and USDT
    new TransactionManager().monitorAllWallets().catch((error) => {
      Logger.error(
        `Failed to initiate wallet monitoring:${JSON.stringify(error, null, 2)}`
      );
    });
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
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: false }));
  }

  private initializeStaticRoutes(): void {
    this.express.use(express.static(path.join(__dirname, "public")));
    this.express.set("view engine", "ejs");
    this.express.set("views", path.join(__dirname, "views"));
    this.express.get("/", (req, res) => {
      res.setHeader("Origin-Agent-Cluster", "?1");
      res.render("index", { uiAppUrl: process.env.REQUEST_NETWORK_UI_URL });
    });
  }

  private initializeHealthCheck(): void {
    this.express.get("/health", (req: Request, res: Response) => {
      res.status(200).json({ status: "ok", timestamp: new Date() });
    });
  }

  private initializeRoutes(): void {
    this.express.use(Cors.getDynamicCorsMiddleware());
    // Setup consumer routes
    // TODO: Might be deprecated in favor of dynamic routing
    // this.express.use(new ConsumerRoute(new ConsumerCtrl()).routes());

    // Loop through all the schema and mount their routes
    [services, wallets].forEach((schema) => {
      const ctrl = new BaseController(schema);
      this.express.use(
        `${this.apiPrefix}/${ctrl.tableName.toLowerCase()}`,
        new BaseRouter(schema, ctrl, UiRequest.interceptor).mount()
      );
    });

    // TODO: test wallet endpoints
    this.express.post("/wallet", (req: Request, res: Response) => {
      const { privateKey, address } = BlockchainManager.createEscrowWallet();
      Logger.info(JSON.stringify({ privateKey, address }));
      res.json({ privateKey, address });
    });

    // Setup dynamic routes
    this.express.use(
      "/",
      new DynamicRouter(ConsumerRequest.interceptor).mount()
    );

    // TODO: for development only
    this.printRoutes(this.express._router);
  }

  private initializeErrorHandling(): void {
    console.log('hreeeee....')
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
        stack.forEach((stackItem: any) => {
          Logger.info(`${stackItem?.method?.toUpperCase()} ${path}`);
        });
      } else if (middleware.name === "router") {
        // Routes added as router middleware
        middleware.handle.stack.forEach((handler: any) => {
          const route = handler.route;
          route &&
            route.stack.forEach((routeStack: any) => {
              Logger.info(`${routeStack?.method?.toUpperCase()} ${route.path}`);
            });
        });
      }
    });
  }

  public init(cb?: (app: App) => void): App {
    Logger.info("Initializing app config...");

    if (process.env.NODE_ENV !== "production")
      Logger.info("App ENV Config: " + JSON.stringify(process.env, null, 2));

    const port: number | string = process.env.API_PORT || 8080;

    this.express.listen(port, () => {
      Logger.info(
        `Server running at ${process.env.API_HOST}... Server Role: ${
          process.env.ROLE || "validator"
        }`
      );

      Cors.init();
      this.initializeHealthCheck();

      if (process.env.ROLE === "cron_handler") {
        this.monitorBlockchainTransactions();
      } else {
        this.initializeMiddlewares();
        this.initializeStaticRoutes();
        this.initializeRoutes();
        this.initializeUpholdConnector();
        Registration.registerWithUI();
      }
      this.initializeErrorHandling();

      cb?.(this);
    });

    return this;
  }
}
