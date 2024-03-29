import Auth from "../auth/auth.js";
import BaseRouter from "./base.js";
export default class AuthRoutes extends BaseRouter {
  private auth: Auth;

  constructor(auth: Auth) {
    super();
    this.auth = auth;
  }

  public initializeRoutes() {
  }


}
