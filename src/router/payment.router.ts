import BaseRouter from "../core/base.router";
import PaymentCtrl from "src/controller/payment.controller";
import { services } from "../db/schema";
import UiRequest from "../auth/ui-request";

export default class PaymentRoute extends BaseRouter {
  constructor(private paymentCtrl: PaymentCtrl) {
    super(services, paymentCtrl);
  }

  public routes() {
    this.register({
      method: "post",
      path: "/payment",
      handler: this.paymentCtrl.handleConsumerPayment,
      interceptor: UiRequest.interceptor,
    });

    return this.router;
  }
}
