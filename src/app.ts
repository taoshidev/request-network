import express, {
  Express,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { services, keys } from "./db/schema.js";
import { BaseController } from "./core/base-controller.js";
import BaseRouter from "./core/base-router.js";
import ConsumerCtrl from "./controller/consumer-controller.js";
import ConsumerRoute from "./router/consumer-routes.js";
import Cors from "./core/cors-whitelist.js";
import Logger from "./utils/logger.js";
import UiRequest from "./auth/ui-request.js";
import DynamicRouter from "./core/dynamic-router.js";
import ConsumerRequest from "./auth/consumer-request.js";

dotenv.config({ path: ".env" });

export default class App {
  public express: Express;
  private apiPrefix: string;

  constructor() {
    this.express = express();
    this.apiPrefix = process.env.API_PREFIX || "/api/v1";
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeMiddlewares(): Promise<void> {
    this.express.use(helmet());
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(Cors.getDynamicCorsMiddleware());
  }

  private initializeRoutes(): void {
    this.express.get("/", (req: Request, res: Response) => {
      res.json({ message: "Validator online..." });
    });

    // Setup consumer routes
    // TODO: Might be deprecated in favor of dynamic routing
    this.express.use(new ConsumerRoute(new ConsumerCtrl()).routes());

    // Loop through all the schema and mount their routes
    [services, keys].forEach((schema) => {
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

    // TODO: for development only
    this.printRoutes(this.express._router);
  }

  private initializeErrorHandling(): void {
    this.express.use((req, res, next) => {
      res.status(404).send("The resource requested cannot be found!");
    });

    this.express.use(
      (err: any, req: Request, res: Response, next: Function) => {
        Logger.error(err.stack);
        const statusCode = err.statusCode || 500;
        const errorMessage = err.message || "Internal Server Error";
        res.status(statusCode).json({ error: errorMessage });
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

  public listen(): void {
    const port: number | string = process.env.API_PORT || 3000;
    this.express.listen(port, () => {
      Logger.info(
        `Server running at ${process.env.API_HOST}:${process.env.API_PORT}`
      );
    });
  }
}
