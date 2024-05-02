import BaseRouter from "../core/base.router";
import ConsumerCtrl from "../controller/consumer.controller";
import { services } from "../db/schema";
import UiRequest from "../auth/ui-request";

export default class ConsumerRoute extends BaseRouter {
  constructor(private consumerCtrl: ConsumerCtrl) {
    super(services, consumerCtrl);
  }

  public routes() {
    this.register({
      method: "post",
      path: "/register-consumer",
      handler: this.consumerCtrl.handleConsumerRegistration,
      interceptor: UiRequest.interceptor,
    });

    return this.router;
  }
}
