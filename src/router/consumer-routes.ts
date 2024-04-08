import BaseRouter from "../core/base-router.js";
import ConsumerCtrl from "../controller/consumer-controller.js";
import { services } from "../db/schema.js";
import ConsumerRequest from "../auth/consumer-request.js";
import UiRequest from "../auth/ui-request.js";

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
    }).register({
      method: "post",
      path: "/consumer-request",
      handler: this.consumerCtrl.handleRequestToValidator,
      interceptor: ConsumerRequest.interceptor,
    });

    return this.router;
  }
}
