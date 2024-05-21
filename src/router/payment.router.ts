import BaseRouter from "../core/base.router";
import PaymentCtrl from "src/controller/payment.controller";
import { enrollments } from "../db/schema";
import PaymentRequest from "../auth/payment-request";

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
      path: "/webhooks",
      handler: this.paymentCtrl.webhooks,
    })

    return this.router;
  }
}