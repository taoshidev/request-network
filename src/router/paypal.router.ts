import BaseRouter from "../core/base.router";
import { enrollments } from "../db/schema";
import PayPalCtrl from "src/controller/paypal.controller";

export default class PayPalRoute extends BaseRouter {
  constructor(private payPalCtrl: PayPalCtrl) {
    super(enrollments, payPalCtrl);
  }

  public routes() {
    this.register({
      method: "post",
      path: "/paypal-orders",
      handler: this.payPalCtrl.createOrder,
      // interceptor: PaymentRequest.interceptor
    }).register({
      method: "post",
      path: '/paypal-orders/:orderId/capture',
      handler: this.payPalCtrl.captureOrder,
      // interceptor: PaymentRequest.interceptor
    });

    return this.router;
  }
}