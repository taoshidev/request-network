import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { services, keys } from "./db/schema.js";
import { BaseController } from "./core/base-controller.js";
import BaseRouter from "./core/base-router.js";
import ConsumerCtrl from "./controller/consumer-controller.js";
import ConsumerRoute from "./router/consumer-routes.js";

dotenv.config({ path: ".env" });

export default class App {
  public express: Express;
  private baseApiUrl: string;

  constructor() {
    this.express = express();
    this.baseApiUrl = process.env.API_URL || "api/v1";
    this.initializeMiddlewares();
    this.initializeSupabase();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.express.use(cors());
    this.express.use(helmet());
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
  }

  private initializeSupabase(): void {
    // ...
  }

  private initializeRoutes(): void {
    this.express.get("/", (req: Request, res: Response) => {
      res.json({ message: "Validator online..." });
    });

    // Setup consumer routes
    const consumerRoutes = new ConsumerRoute(new ConsumerCtrl());
    this.express.use(`/${this.baseApiUrl}`, consumerRoutes.routes());
    // Loop through all the schema and mount their routes
    [services, keys].forEach((schema) => {
      const ctrl = new BaseController(schema);
      const router = new BaseRouter(schema, ctrl);
      this.express.use(
        `/${this.baseApiUrl}/${ctrl.tableName.toLowerCase()}`,
        router.mount()
      );
    });

    // TODO: for development only
    this.printRoutes(this.express._router);
  }

  private initializeErrorHandling(): void {
    this.express.use((req, res, next) => {
      res.status(404).send("The resource requested cannot be found!");
    });

    this.express.use(
      (err: any, req: Request, res: Response, next: Function) => {
        console.error(err.stack);
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
          console.log(`${stackItem.method.toUpperCase()} ${path}`);
        });
      } else if (middleware.name === "router") {
        // Routes added as router middleware
        middleware.handle.stack.forEach((handler: any) => {
          const route = handler.route;
          route &&
            route.stack.forEach((routeStack: any) => {
              console.log(`${routeStack.method.toUpperCase()} ${route.path}`);
            });
        });
      }
    });
  }

  public listen(): void {
    const port: number | string = process.env.API_PORT || 3000;
    this.express.listen(port, () => {
      console.log(
        `Server running at ${process.env.API_HOST}:${process.env.API_PORT}`
      );
    });
  }
}
