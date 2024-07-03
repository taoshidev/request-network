import BaseRouter from "../core/base.router";
import PaymentCtrl from "../controller/payment.controller";
import { stripe_enrollments } from "../db/schema";
import PaymentRequest from "../auth/payment-request";
import UiRequest from "../auth/ui-request";

export default class PaymentRoute extends BaseRouter {
  constructor(private paymentCtrl: PaymentCtrl) {
    super(stripe_enrollments, paymentCtrl);
  }

  public routes() {
    this.register({
      method: "post",
      path: "/stripe-payment-intent",
      handler: this.paymentCtrl.createPaymentIntent,
      interceptor: PaymentRequest.interceptor
    }).register({
      method: "post",
      path: "/stripe-payment/activate",
      handler: this.paymentCtrl.activate,
      interceptor: PaymentRequest.interceptor
    }).register({
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