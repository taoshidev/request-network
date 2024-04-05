import BaseRouter from "../core/base-router.js";
import ConsumerCtrl from "../controller/consumer-controller.js";
import { services } from "../db/schema.js";
import ConsumerRequestInterceptor from "../auth/consumer-request-interceptor.js";
import RnUiRequestInterceptor from "../auth/rn-ui-request-interceptor.js";

export default class ConsumerRoute extends BaseRouter {
  constructor(private consumerCtrl: ConsumerCtrl) {
    super(services, consumerCtrl);
  }

  public routes() {
    this.registerRoute({
      method: "post",
      path: "/register-consumer",
      handler: this.consumerCtrl.handleConsumerRegistration,
      interceptor: RnUiRequestInterceptor.requestInterceptor,
    });
    this.registerRoute({
      method: "post",
      path: "/consumer-request",
      handler: this.consumerCtrl.handleRequestToValidator,
      interceptor: ConsumerRequestInterceptor.requestInterceptor,
    });

    return this.router;
  }
}
