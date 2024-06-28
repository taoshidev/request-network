import UiRequest from "src/auth/ui-request";
import PaymentRequest from "../auth/payment-request";
import BaseRouter from "../core/base.router";
import { paypal_enrollments } from "../db/schema";
import PayPalCtrl from "src/controller/paypal.controller";

export default class PayPalRoute extends BaseRouter {
  constructor(private payPalCtrl: PayPalCtrl) {
    super(paypal_enrollments, payPalCtrl);
  }

  public routes() {
    this.register({
      method: "post",
      path: "/paypal-orders",
      handler: this.payPalCtrl.createOrder,
      interceptor: PaymentRequest.interceptor
    })
    this.register({
      method: "post",
      path: "/paypal-subscriptions",
      handler: this.payPalCtrl.createSubscription,
      interceptor: PaymentRequest.interceptor
    })
    this.register({
      method: "post",
      path: "/paypal-subscriptions/activate",
      handler: this.payPalCtrl.activate,
      interceptor: PaymentRequest.interceptor
    })
    .register({
      method: "post",
      path: '/paypal-orders/:orderId/capture',
      handler: this.payPalCtrl.captureOrder,
      interceptor: PaymentRequest.interceptor
    }).register({
      method: "post",
      path: '/has-paypal',
      handler: this.payPalCtrl.checkForPayPal,
      interceptor: UiRequest.interceptor
    });

    return this.router;
  }
}