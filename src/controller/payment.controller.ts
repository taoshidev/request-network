import { Request, Response } from "express";
import { services } from "../db/schema";
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
    super(services);
  }

  /**
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
}
