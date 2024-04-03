import axios, { AxiosError } from "axios";
import Logger from "../utils/logger.js";
import * as dotenv from "dotenv";
import { ServiceDTO } from "../db/dto/service-dto.js";
import { Request } from "express";
import ConsumerCtrl from "../controller/consumer-controller.js";
import { ConsumerDTO } from "../db/dto/consumer-dto.js";
import { services } from "../db/schema.js";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env" });

/**
 * Interceptor for handling consumer request authentication.
 * Ensures that incoming requests have a valid token for authentication.
 */
export default class Auth {
  private static UNKEY_VERIFY_URL = "https://api.unkey.dev/v1/keys.verifyKey";
  // TODO: replace this with validator api key when available from UI app
  private static API_ID = process.env.UNKEY_API_ID;
  private static consumerCtrl = new ConsumerCtrl();
  /**
   * Verifies the provided token with Unkey or a custom authentication service.
   * @param {string} token - The token to verify.
   * @returns {Promise<boolean>} - A promise that resolves to true if the token is verified, otherwise false.
   */
  public static async verifyRequest(
    req: Request,
    keyName: string
  ): Promise<Partial<ConsumerDTO> | boolean> {
    // Verify the request with unkey
    const token = Auth.extractToken(req, keyName);
    if (!token) {
      Logger.error("No token provided");
      return false;
    }
    try {
      const response = await axios({
        method: "POST",
        url: Auth.UNKEY_VERIFY_URL,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          apiId: Auth.API_ID,
          key: token,
        },
      });
      Logger.info("response from verify: " + JSON.stringify(response.data));

      const { keyId, meta } = response?.data as ConsumerDTO;

      // verify the consumer exists in local database
      const resp = await this.consumerCtrl.find(
        eq(services.rnConsumerRequestKey, keyId)
      );

      const { rnValidatorMeta } = resp?.data?.[0] as ServiceDTO;

      // TODO: need to swap this out or add in checks for subscriptionId and endpoint
      if (!meta?.shortId || meta?.shortId !== rnValidatorMeta?.shortId) {
        throw new Error("Unauthorized: Invalid request key");
      }

      // Return response to the next middleware
      return response?.data;
    } catch (error: AxiosError | unknown) {
      Logger.error(`Error verifying token with Unkey: ${error}`);
      return false;
    }
  }

  /**
   * Retrieves a token from the request headers, custom header, or query parameters.
   * @param {Request} req - The incoming request object.
   * @returns {string | null} - The extracted token, if found, otherwise null.
   */
  public static extractToken(req: Request, tokenName: string): string | null {
    if (
      req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Bearer"
    ) {
      return req.headers.authorization.split(" ")[1];
    } else if (req.headers[tokenName]) {
      return req.headers[tokenName] as string;
    } else if (req.query && req.query.token) {
      return req.query.token as string;
    }
    return null;
  }
}
