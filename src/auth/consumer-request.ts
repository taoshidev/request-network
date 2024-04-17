import { Response, NextFunction } from "express";
import Auth from "./auth";
import Logger from "../utils/logger";
import { CustomRequestDTO } from "../db/dto/custom-request.dto";

/**
 * Interceptor for handling consumer request authentication.
 * Ensures that incoming requests have a valid token for authentication.
 */
export default class ConsumerRequest {
  /**
   * Main interceptor function to check for the presence and validity of a consumer token.
   * @param {CustomRequestDTO} req - The incoming request object from Express.
   * @param {Response} res - The outgoing response object for Express.
   * @param {NextFunction} next - Callback to pass control to the next middleware.
   * @returns {Promise<void>} - A promise that resolves when the authentication check is complete.
   * If authentication fails, it responds with an appropriate HTTP status code and error message.
   */
  static interceptor = async (
    req: CustomRequestDTO,
    res: Response,
    next: NextFunction
  ) => {
    const consumer = await Auth.verifyRequest(req, res, next,{
      type: "x-taoshi-consumer-request-key",
    });

    if (!consumer) {
      // Logger.error("Unauthorized");
      return;
      // return res.status(403).json({ error: "Unauthorized" });
    }

    // Add response from Unkey to the request object for use in the next middleware
    req.consumer = consumer as CustomRequestDTO["consumer"];

    next();
  };
}
