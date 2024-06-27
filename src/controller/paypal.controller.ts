import { Request, Response } from "express";
import { paypal_enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import { isEqual as _isEqual } from 'lodash';
import PayPalManager from "src/service/paypal.manager";


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
