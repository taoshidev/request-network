import { Response, NextFunction } from "express";
import Auth from "./auth";
import Logger from "../utils/logger";
import { CustomRequestDTO } from "../db/dto/custom-request.dto";

/**
 * Class to intercept requests and perform authentication.
 */
export default class UiRequest {
  /**
   * Middleware to intercept requests and validate authentication tokens.
   * @param req Custom request object containing the request information.
   * @param res Response object to send back the HTTP response.
   * @param next Callback to pass control to the next middleware function.
   */
  static interceptor = async (
    req: CustomRequestDTO,
    res: Response,
    next: NextFunction
  ) => {
    const apiKey = await Auth.extractToken(req, {
      type: "x-taoshi-request-key",
    });
    // Verify the token
    if (!apiKey) {
      Logger.error("Unauthorized: No token provided");
      return res.status(403).json({ error: "Unauthorized: No token provided" });
    }
    // Check validity of the token
    const verified = await Auth.verifySignature(
      req,
      apiKey,
      process?.env?.TAOSHI_VALIDATOR_API_SECRET || ""
    );
    if (!verified) {
      Logger.error("Unauthorized: Signature check failed");
      return res
        .status(403)
        .json({ error: "Unauthorized: Signature check failed" });
    }

    next();
  };
}
