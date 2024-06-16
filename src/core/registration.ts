import axios, { AxiosError } from "axios";
import Logger from "../utils/logger";
import { AuthenticatedRequest, XTaoshiHeaderKeyType } from "./auth-request";
import ServiceManager from "../service/service.manager";
import { ServiceDTO } from "../db/dto/service.dto";
import StripeManager from "../service/stripe.manager";

/**
 * Handles registration of the API instance with the UI application.
 */
export default class Registration {
  /**
   * Registers the API instance with the UI application using credentials.
   * Sets the API instance as active if the registration is successful.
   */
  static async registerWithUI(): Promise<void> {
    const validatorIds = await new ServiceManager()
      .getDistinctValidators()
      .then((res) => res.data as ServiceDTO[]);

    const validators = validatorIds?.map((v) =>
      Object.assign(
        { id: v.validatorId },
        { apiPrefix: process.env.API_PREFIX },
        { baseApiUrl: process.env.API_HOST }
      )
    );

    const stripeStatus = await new StripeManager().checkForStripe();
    const body = {
      baseApiUrl: AuthenticatedRequest.baseURL,
      apiPrefix: process.env.API_PREFIX,
      validators,
      stripeStatus
    };

    try {
      await AuthenticatedRequest.send({
        method: "POST",
        path: "/api/register",
        body,
        xTaoshiKey: XTaoshiHeaderKeyType.Validator,
      });
      Logger.info("Validator API online configuration complete...");
    } catch (error) {
      Registration.handleError(error);
    }
  }

  /**
   * Logs detailed errors based on the type of AxiosError encountered during the request.
   * @param {AxiosError | unknown} error The error caught during the Axios request.
   */
  private static handleError(error: AxiosError | unknown): void {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        Logger.error(
          `Failed to register with UI app at ${process.env.REQUEST_NETWORK_UI_URL}: Is the UI app running?`
        );
      } else {
        Logger.error(
          `Failed to register with UI app at ${process.env.REQUEST_NETWORK_UI_URL} Error: ${error.message}`
        );
      }
    } else {
      Logger.error("An unexpected error occurred during registration.");
    }
  }
}
