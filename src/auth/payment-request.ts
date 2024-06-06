import { Request, Response, NextFunction } from "express";
import * as jwt from 'jsonwebtoken';

/**
 * Interceptor for handling stripe payments authentication.
 * Ensures that incoming requests have a valid token for authentication.
 */
export default class PaymentRequest {
  /**
   * Interceptor function to check for the presence and validity of a token.
   * If authentication fails, it responds with an appropriate HTTP status code and error message.
   */
  static interceptor = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const token = await jwt.verify(req.body.rnToken, process.env.STRIPE_ENROLLMENT_SECRET as string);
    if (req.body) req.body.tokenData = token;

    if (token) {
      next();
    } else {
      throw Error('Token error');
    }
  };
}
