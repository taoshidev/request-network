import { Router, Request, Response, NextFunction } from "express";

type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
type RequestInterceptor = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export default class BaseRouter {
  public router: Router;

  constructor(private requestInterceptor?: RequestInterceptor) {
    this.router = Router();
    if (this.requestInterceptor) {
      this.router.use(this.requestInterceptor);
    }
  }

  public registerRoute(
    method: "get" | "post" | "put" | "delete",
    path: string,
    handler: RouteHandler
  ): void {
    this.router[method](path, handler);
  }
}
