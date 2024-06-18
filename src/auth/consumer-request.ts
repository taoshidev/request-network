import { Response, NextFunction } from "express";
import Auth from "./auth";
import { CustomRequestDTO } from "../db/dto/custom-request.dto";
import {
  AuthenticatedRequest,
  XTaoshiHeaderKeyType,
} from "../core/auth-request";
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
    const consumer = await Auth.verifyRequest(req, res, next, {
      type: "x-taoshi-consumer-request-key",
    });

    if (!consumer) {
      return res.status(401).json({ error: "Invalid consumer token." });
    }

    if (req?.headers[XTaoshiHeaderKeyType.Consumer])
      delete req?.headers[XTaoshiHeaderKeyType.Consumer];

    req.headers = Object.assign(
      req?.headers,
      !req?.headers.authorization && {
        authorization: `Bearer ${AuthenticatedRequest.apiKey}`,
      },
      AuthenticatedRequest.setAuthHeaders(
        XTaoshiHeaderKeyType.Validator,
        req?.method,
        req?.path,
        JSON.stringify(req?.body),
        Date.now().toString()
      )
    );

    req.consumer = consumer as CustomRequestDTO["consumer"];

    next();
  };
}
