import { Router, Request, Response, NextFunction } from "express";

type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
type RequestInterceptor = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

import { BaseController } from "./base-controller.js";
import { PgTableWithColumns } from "drizzle-orm/pg-core";

export default class BaseRouter {
  public router: Router;

  constructor(
    protected schema: PgTableWithColumns<any>,
    protected ctrl: BaseController,
    private requestInterceptor?: RequestInterceptor
  ) {
    this.router = Router();
  }

  public registerRoute({
    method,
    path,
    handler,
    interceptor,
  }: {
    method: "get" | "post" | "put" | "delete";
    path: string;
    handler: RouteHandler;
    interceptor?: RouteHandler;
  }): void {
    const middleware = [handler as RouteHandler];
    if(interceptor) middleware.unshift(interceptor as RouteHandler);
    this.router[method](path, middleware);
  }

  public mount() {
    if (this.requestInterceptor) this.router.use("/", this.requestInterceptor);
    // [schema-name]/id/ab3445
    this.router.use("/:id", this.ctrl.findByIdInterceptor());
    // [schema-name]/
    this.router.route("/").get(this.ctrl.findAll()).post(this.ctrl.insert());
    // [schema-name]/id/ab3445
    this.router
      .route("/:id")
      .get(this.ctrl.findOne())
      .put(this.ctrl.mutate())
      .delete(this.ctrl.remove());

    return this.router;
  }
}
