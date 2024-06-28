import { Request, Response } from "express";
import { stripe_enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import Logger from "../utils/logger";
import StripeManager from "../service/stripe.manager";
import { EnrollmentPaymentRequestDTO } from "../db/dto/enrollment-payment-request.dto";
import { EnrollmentPaymentDTO } from "../db/dto/enrollment-payment.dto";
import * as jwt from 'jsonwebtoken';
import ServiceManager from "../service/service.manager";
import { isEqual as _isEqual } from 'lodash';
import PayPalManager from "../service/paypal.manager";

/**
 * Controller for handling payments.
 */
export default class PaymentCtrl extends BaseController {
  stripeService: StripeManager;
  payPalService: PayPalManager;
  serviceService: ServiceManager;

  constructor() {
    super(stripe_enrollments);

    this.stripeService = new StripeManager();
    this.payPalService = new PayPalManager();
    this.serviceService = new ServiceManager();
  }

  /**
   * @param {Request} req - Express.js request object containing the enrollment information in the body.
   * @param {Response} res - Express.js response object.
   * @param {NextFunction} next - Express.js next middleware function.
   * @returns A 201 status code and the enrollment id and enrollment email on success, or a 400 status code with an error message on failure.
   */
  handleConsumerPayment = async (req: Request, res: Response) => {
    const { body } = req as EnrollmentPaymentRequestDTO;

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
      let webhookRes;
      const isStripe = !!req.headers?.['stripe-signature'];
      const isPayPal = !!req.headers?.['paypal-transmission-id'];

      switch (true) {
        case !!isStripe:
          webhookRes = await this.stripeService.stripeWebhook(req, res);
          break;
        case !!isPayPal:
          webhookRes = await this.payPalService.payPalWebhook(req, res);
          break;
        default:
          Logger.error("Webhook not valid.");
          return res
            .status(500)
            .json({ error: "Internal server error" });
      }

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
      const secret = process.env.PAYMENT_ENROLLMENT_SECRET || '';
      const service = await this.serviceService.one(body.serviceId);

      if (service.data) {
        const token = jwt.sign({
          serviceId: service.data.id,
          name: service.data.name,
          url: body.url,
          email: body.email,
          price: service.data.price,
          redirect: body.redirect,
          consumerServiceId: service.data.consumerServiceId,
          subscriptionId: service.data.subscriptionId,
          endpointId: service.data.endpointId
        }, secret, { expiresIn: '20m' });

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

  checkForStripe = async (req?: Request, res?: Response) => {
    return this.stripeService.checkForStripe(req, res);
  }
}
