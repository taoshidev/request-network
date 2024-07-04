import { Request, Response, NextFunction } from "express";
import * as jwt from 'jsonwebtoken';
import ServiceManager from "src/service/service.manager";

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
    try {
      const serviceService = new ServiceManager();
      const data = JSON.parse(Buffer.from(req.body?.rnToken.split('.')[1], 'base64').toString());
      const service = await serviceService.one(data.serviceId);
      const token = await jwt.verify(req.body.rnToken, process.env.PAYMENT_ENROLLMENT_SECRET as string + service.data?.hash);
      delete service.data?.hash;
      
      if (req.body) {
        req.body.tokenData = token;
        req.body.service = service?.data;
      }

      if (!token) {
        throw Error('Token error');
      }
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Error: Unauthorized" });
    }

    next();
  };
}
