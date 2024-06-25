import { Request, Response } from "express";
import { enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import { isEqual as _isEqual } from 'lodash';
import PayPalManager from "src/service/paypal.manager";


/**
 * Controller for handling payments.
 */
export default class PayPalCtrl extends BaseController {
  payPalService: PayPalManager;

  constructor() {
    super(enrollments);

    this.payPalService = new PayPalManager();
  }

  createOrder = async (req: Request, res: Response) => {
    const { cart } = req.body;
    const order = await this.payPalService.createOrder(cart);

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
}
