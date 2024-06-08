import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  Method,
} from "axios";
import Auth from "../auth/auth";
import Logger from "../utils/logger";

export type RequestOptions = {
  method: Method;
  path: string;
  body: object;
  xTaoshiKey: string;
};

export enum XTaoshiHeaderKeyType {
  UI = "x-taoshi-request-key",
  Consumer = "x-taoshi-consumer-request-key",
  Validator = "x-taoshi-validator-request-key",
}

export class AuthenticatedRequest {
  static baseURL = process.env.API_HOST || "http://localhost:8080";
  static uiUrl = process.env.REQUEST_NETWORK_UI_URL || "http://localhost:3000";
  static apiKey = process.env.TAOSHI_API_KEY || "";
  static apiSecret = process.env.TAOSHI_VALIDATOR_API_SECRET || "";

  static setAuthHeaders(
    xTaoshiKey: string,
    method: string,
    path: string,
    jsonBody: string,
    nonce: string
  ) {
    const signature = Auth.createSignature({
      method,
      path,
      body: jsonBody,
      apiKey: AuthenticatedRequest.apiKey,
      apiSecret: AuthenticatedRequest.apiSecret,
      nonce,
    });

    return {
      "Content-Type": "application/json",
      [xTaoshiKey]: AuthenticatedRequest.apiKey,
      Authorization: `Bearer ${signature}`,
      "x-taoshi-nonce": nonce,
    };
  }
  /**
   * Sends an authenticated request to the specified path with the given body.
   * The appropriate x-header key is dynamically included in the request headers.
   * @param options - The request options including method, path, body, and x-header key.
   */
  static async send(
    options: RequestOptions
  ): Promise<AxiosResponse | undefined> {
    const { method, path, body, xTaoshiKey } = options;
    const url = `${AuthenticatedRequest.uiUrl}${path}`;
    const nonce = Date.now().toString();
    const jsonBody = JSON.stringify(body);

    const headers = AuthenticatedRequest.setAuthHeaders(
      xTaoshiKey,
      method,
      path,
      jsonBody,
      nonce
    );

    const config: AxiosRequestConfig = {
      method,
      url,
      data: jsonBody,
      headers,
    };

    try {
      const response = await axios(config);
      if (response.status === 200) {
        Logger.info("Authenticated request successful");
        return response;
      }
    } catch (error) {
      Logger.error(
        `Authenticated request failed: ${(error as AxiosError)?.message}`
      );
      throw error;
    }
  }
}
