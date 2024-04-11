import axios, { AxiosError } from "axios";
import Logger from "../utils/logger.js";
import * as dotenv from "dotenv";
import { ServiceDTO } from "../db/dto/service-dto.js";
import { Request } from "express";
import ConsumerCtrl from "../controller/consumer-controller.js";
import { ConsumerDTO } from "../db/dto/consumer-dto.js";
import { services } from "../db/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

dotenv.config({ path: ".env" });

/**
 * Interceptor for handling consumer request authentication.
 * Ensures that incoming requests have a valid token for authentication.
 */
export default class Auth {
  private static UNKEY_VERIFY_URL = process.env.UNKEY_VERIFY_URL;
  // TODO: replace this with validator api key when available from UI app
  private static API_ID = process.env.TAOSHI_API_KEY;
  private static consumerCtrl = new ConsumerCtrl();
  /**
   * Verifies the provided token with Unkey or a custom authentication service.
   * @param {string} token - The token to verify.
   * @returns {Promise<boolean>} - A promise that resolves to true if the token is verified, otherwise false.
   */
  public static async verifyRequest(
    req: Request,
    { type }: { type: string }
  ): Promise<Partial<ConsumerDTO> | boolean> {
    // Verify the request with unkey
    const token = Auth.extractToken(req, { type });
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

      Logger.info(`Unkey Response: ${JSON.stringify(response.data)}`);
      const { keyId, meta: data } = response?.data as ConsumerDTO;

      if (!keyId) {
        throw new Error("Unauthorized: Invalid request key");
      }

      const resp = await this.consumerCtrl.find(
        eq(services.consumerKeyId, keyId)
      );

      const { meta } = resp?.data?.[0] as ServiceDTO;

      if (!data?.shortId || data?.shortId !== meta?.shortId) {
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
  public static extractToken(
    req: Request,
    { type }: { type: string }
  ): string | null {
    if (
      req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Bearer"
    ) {
      return req.headers.authorization.split(" ")[1];
    } else if (req.headers[type]) {
      return req.headers[type] as string;
    } else if (req.query && req.query.token) {
      return req.query.token as string;
    }
    return null;
  }

  /**
   * Generates a cryptographic signature based on request details and a secret key.
   * The signature is intended to verify the authenticity and integrity of the request.
   *
   * @param {Object} params - Parameters for generating the signature.
   * @param {string} params.method - The HTTP method of the request (e.g., "GET", "POST").
   * @param {string} params.path - The request path.
   * @param {object | any} params.body - The body of the request. Expected to be serialized to a string if an object.
   * @param {string} params.apiKey - The API key associated with the request. Included in the signature for validation.
   * @param {string} params.apiSecret - The secret key used to generate the HMAC signature.
   * @param {string} params.nonce - A unique nonce for the request, to prevent replay attacks.
   * @returns {string} - The generated HMAC signature as a hex string.
   */
  public static createSignature({
    method,
    path,
    body,
    apiKey,
    apiSecret,
    nonce,
  }: {
    method: string;
    path: string;
    body: object | any;
    apiKey: string;
    apiSecret: string;
    nonce: string;
  }) {
    const message = `${method}${path}${body}${apiKey}${nonce}`;
    console.log("MESSAGE::", message);
    return crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
  }

  public static verifySignature(
    req: Request,
    apiKey: string = "",
    apiSecret: string,
    on: "ui" | "consumer" | "validator" = "ui"
  ) {
    const keyTypeMapping = {
      ui: "x-taoshi-request-key",
      consumer: "x-taoshi-consumer-request-key",
      validator: "x-taoshi-validator-request-key",
    };

    if (!apiKey) {
      const headerKey = keyTypeMapping[on];
      apiKey = Auth.extractToken(req, { type: headerKey }) || "";
    }

    const signature = req.headers["x-taoshi-signature"];
    const nonce = Array.isArray(req.headers["x-taoshi-nonce"])
      ? req.headers["x-taoshi-nonce"][0]
      : req.headers["x-taoshi-nonce"] || "";

    const requestDetails = {
      method: req.method,
      path: req.originalUrl,
      body: JSON.stringify(req.body),
      apiKey,
      apiSecret,
      nonce,
    };

    const expectedSignature = this.createSignature(requestDetails);

    return signature === expectedSignature;
  }
}
