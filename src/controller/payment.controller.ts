import { Request, Response } from "express";
import { enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import Logger from "../utils/logger";
import StripeManager from "src/service/stripe.manager";
import { EnrollmentPaymentRequestDTO } from "src/db/dto/enrollment-payment-request.dto";
import { EnrollmentPaymentDTO } from "src/db/dto/enrollment-payment.dto";
import * as jwt from 'jsonwebtoken';
import ServiceManager from "src/service/service.manager";

/**
 * Controller for handling payments.
 */
export default class PaymentCtrl extends BaseController {
  stripeService = new StripeManager();
  serviceService = new ServiceManager();

  constructor() {
    super(enrollments);
  }

  /**
   * @param {Request} req - Express.js request object containing the enrollment information in the body.
   * @param {Response} res - Express.js response object.
   * @param {NextFunction} next - Express.js next middleware function.
   * @returns A 201 status code and the enrollment id and enrollment email on success, or a 400 status code with an error message on failure.
   */
  handleConsumerPayment = async (req: Request, res: Response) => {
    const { body, body: { tokenData } } = req as EnrollmentPaymentRequestDTO;

    if (!body?.rnToken)
      return res.status(400).json({ error: "Request missing payload" });


    try {
      const enrollment = await this.stripeService.enroll(body as EnrollmentPaymentDTO);
      return res
        .status(201)
        .json(enrollment);
    } catch (error: Error | unknown) {
      Logger.error("Error processing payment:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  };

  handleUnsubscribe = async (req: Request, res: Response) => {
    try {
      const { serviceId } = req.body;
      const unsubscribedService = await this.stripeService.cancelSubscription(serviceId);

      return res
        .status(201)
        .json(unsubscribedService);
    } catch (error) {
      Logger.error("Error cancelling subscription:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  }

  /**
  * @param {Request} req - Express.js request object containing webhook information in the body.
  * @param {Response} res - Express.js response object.
  * @param {NextFunction} next - Express.js next middleware function.
  * @returns A 201 status code and ok message on success, or a 400 status code with an error message on failure.
  */
  webhooks = async (req: Request, res: Response) => {
    try {
      const webhookRes = await this.stripeService.stripeWebhook(req, res);
      return res
        .status(201)
        .json(webhookRes);
    } catch (error: Error | unknown) {
      Logger.error("Error processing payment:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  };

  /**
 * Creates a token that will need to be sent back to create a stripe subscription.
 * @param {Request} req - Express.js request object containing the service id in the body.
 * @param {Response} res - Express.js response object.
 * @param {NextFunction} next - Express.js next middleware function.
 * @returns A 201 status code and the token on success, or a 400 status code with an error message on failure.
 */
  getPaymentToken = async (req: Request, res: Response) => {
    try {
      const { body } = req;
      const secret = process.env.ENROLLMENT_SECRET || '';
      const service = await this.serviceService.one(body.serviceId);

      if (service.data) {
        const token = jwt.sign({
          serviceId: service.data.id,
          name: service.data.name,
          url: body.url,
          email: body.email,
          redirect: body.redirect,
          subscriptionId: service.data.subscriptionId,
          endpointId: service.data.endpointId
        }, secret, { expiresIn: '120m' });

        return res
          .status(200)
          .json({ token });
      } else {
        throw Error('Error finding service.');
      }
    } catch (error: Error | unknown) {
      Logger.error("Error creating token:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  }

  checkForStripe = async (req: Request, res: Response) => {
    try {
      let ok = false;
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY && process.env.ENROLLMENT_SECRET) {
        ok = true;
      }
      return res
        .status(200)
        .json({ ok });
    } catch (error: Error | unknown) {
      Logger.error("Error creating token:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ ok: false, error: (error as Error)?.message || "Internal server error" });
    }
  }
}
