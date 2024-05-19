import { Request, Response } from "express";
import { enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import Logger from "../utils/logger";
import StripeManager from "src/service/stripe.manager";
import { EnrollmentPaymentRequestDTO } from "src/db/dto/enrollment-payment-request.dto";
import { EnrollmentPaymentDTO } from "src/db/dto/enrollment-payment.dto";

/**
 * Controller for handling payments.
 */
export default class PaymentCtrl extends BaseController {
  stripeService = new StripeManager();

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
    const { body } = req as EnrollmentPaymentRequestDTO;

    if (!body)
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
}
