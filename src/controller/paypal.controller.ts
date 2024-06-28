import { Request, Response } from "express";
import { paypal_enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import { isEqual as _isEqual } from 'lodash';
import PayPalManager from "../service/paypal.manager";
import Logger from "../utils/logger";

/**
 * Controller for handling payments.
 */
export default class PayPalCtrl extends BaseController {
  payPalService: PayPalManager;

  constructor() {
    super(paypal_enrollments);

    this.payPalService = new PayPalManager();
  }

  createOrder = async (req: Request, res: Response) => {

    const { body } = req;
    if (!body?.rnToken)
      return res.status(400).json({ error: "Request missing payload" });

    const order = await this.payPalService.createOrder(body);

    return res
      .status(order.httpStatusCode)
      .json(order.jsonResponse);
  }

  createSubscription = async (req: Request, res: Response) => {
    const { body } = req;

    if (!body?.rnToken)
      return res.status(400).json({ error: "Request missing payload" });

    const order = await this.payPalService.createSubscription(body);

    return res
      .status(order.httpStatusCode)
      .json(order.jsonResponse);
  }

  activate = async (req: Request, res: Response) => {
    try {
      const { body } = req;
      const secret = process.env.PAYMENT_ENROLLMENT_SECRET || '';

      if (!body?.rnToken)
        return res.status(400).json({ error: "Request missing payload" });

      const activate = await this.payPalService.activate(body);

      return res
        .status(200)
        .json(activate);
    } catch (error: Error | unknown) {
      Logger.error("Error processing payment:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  }

  captureOrder = async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const order = await this.payPalService.captureOrder(orderId);

    return res
      .status(order.httpStatusCode)
      .json(order.jsonResponse);
  }

  checkForPayPal = async (req?: Request, res?: Response) => {
    return this.payPalService.checkForPaypal(req, res);
  }
}
