import axios, { AxiosError } from "axios";
import Logger from "../utils/logger";
import Auth from "../auth/auth";

/**
 * Handles registration of the API instance with the UI application.
 */
export default class Registration {
  /**
   * Registers the API instance with the UI application using credentials and API paths defined in environment variables.
   * Sets the API instance as active if the registration is successful.
   */
  static async registerWithUI(): Promise<void> {
    const apiUrl = process.env.API_HOST || "http://localhost:8080";
    const uiUrl = process.env.REQUEST_NETWORK_UI_URL || "http://localhost:3000";
    const apiKey = process.env.TAOSHI_API_KEY || "";
    const apiSecret = process.env.TAOSHI_VALIDATOR_API_SECRET || "";

    const url = `${uiUrl}/api/register`;
    const body = { apiUrl };
    const nonce = Date.now().toString();

    const signature = Auth.createSignature({
      method: "POST",
      path: "/api/register",
      body: JSON.stringify(body),
      apiKey,
      apiSecret,
      nonce,
    });

    const headers = {
      "Content-Type": "application/json",
      "x-taoshi-validator-request-key": apiKey,
      Authorization: `Bearer ${signature}`,
      "x-taoshi-nonce": nonce,
    };

    try {
      const response = await axios.post(url, body, { headers });

      if (response.status === 200) {
        Logger.info("Validator API online configuration complete...");
      }
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
        Logger.error("Failed to register with UI app: Is the UI app running?");
      } else {
        Logger.error(`Failed to register with UI app: ${error.message}`);
      }
    } else {
      Logger.error("An unexpected error occurred during registration.");
    }
  }
}
