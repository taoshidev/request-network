import BaseRouter from "../core/base.router";
import PaymentCtrl from "../controller/payment.controller";
import { enrollments } from "../db/schema";
import PaymentRequest from "../auth/payment-request";
import UiRequest from "../auth/ui-request";

export default class PaymentRoute extends BaseRouter {
  constructor(private paymentCtrl: PaymentCtrl) {
    super(enrollments, paymentCtrl);
  }

  public routes() {
    this.register({
      method: "post",
      path: "/payment",
      handler: this.paymentCtrl.handleConsumerPayment,
      interceptor: PaymentRequest.interceptor
    }).register({
      method: "post",
      path: "/cancel-subscription",
      handler: this.paymentCtrl.handleUnsubscribe,
      interceptor: UiRequest.interceptor,
    }).register({
      method: "post",
      path: '/request-payment',
      handler: this.paymentCtrl.getPaymentToken,
      interceptor: UiRequest.interceptor
    }).register({
      method: "post",
      path: '/has-stripe',
      handler: this.paymentCtrl.checkForStripe,
      interceptor: UiRequest.interceptor
    }).register({
      method: "post",
      path: "/webhooks",
      handler: this.paymentCtrl.webhooks,
    });

    return this.router;
  }
}