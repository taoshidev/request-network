import { Response, NextFunction } from "express";
import Auth from "./auth.js";
import Logger from "../utils/logger.js";
import { CustomRequestDTO } from "../db/dto/custom-request-dto.js";

/**
 * Class to intercept requests and perform authentication.
 */
export default class RnUiRequestInterceptor {
  /**
   * Middleware to intercept requests and validate authentication tokens.
   * @param req Custom request object containing the request information.
   * @param res Response object to send back the HTTP response.
   * @param next Callback to pass control to the next middleware function.
   */
  static requestInterceptor = async (
    req: CustomRequestDTO,
    res: Response,
    next: NextFunction
  ) => {
    const token = await Auth.extractToken(req, {
      type: "x-taoshi-request-key",
    });
    // TODO: JWT verify the token
    if (!token) {
      Logger.error("Unauthorized");
      return res.status(403).json({ error: "Unauthorized" });
    }

    next();
  };
}
