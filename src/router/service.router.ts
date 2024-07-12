import BaseRouter from "../core/base.router";
import { services } from "../db/schema";
import UiRequest from "../auth/ui-request";
import ServiceCtrl from "src/controller/service.controller";

export default class ServiceRoute extends BaseRouter {
  constructor(private serviceCtrl: ServiceCtrl) {
    super(services, serviceCtrl);
  }

  public routes() {
    this.register({
      method: "put",
      path: "/update-service/:id",
      handler: this.serviceCtrl.updateService,
      interceptor: UiRequest.interceptor,
    });

    return this.router;
  }
}
