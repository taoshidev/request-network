import BaseRouter from "../core/base.router";
import PaymentCtrl from "src/controller/payment.controller";
import { enrollments } from "../db/schema";
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
      interceptor: UiRequest.interceptor,
    });
    this.register({
      method: "post",
      path: "/webhooks",
      handler: this.paymentCtrl.webhooks
    })

    return this.router;
  }
}