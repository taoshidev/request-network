import { Router, RequestHandler } from "express";
import HTTPRequest from "./request";

/**
 * The DynamicRouter class extends the HTTPRequest class to dynamically handle
 * routing based on HTTP methods for a specified path. It utilizes Express's Router
 * to define route handling and can apply custom middlewares or interceptors.
 */
export default class DynamicRouter extends HTTPRequest {
  public router: Router;

  constructor(private requestInterceptor: RequestHandler) {
    super();
    this.router = Router();
  }

  /**
   * Mounts routes and applies the request interceptor and fetch method for all HTTP methods.
   *
   * @returns {Router} Returns the configured router instance which can be used in Express applications.
   */
  public mount() {
    this.router.route(`(*)?`).all([this.requestInterceptor, this.fetch]);
    return this.router;
  }
}
