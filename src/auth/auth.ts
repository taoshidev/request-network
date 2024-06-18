import axios, { AxiosError } from "axios";
import Logger from "../utils/logger";
import { ServiceDTO } from "../db/dto/service.dto";
import { Request, Response, NextFunction } from "express";
import ConsumerCtrl from "../controller/consumer.controller";
import { ConsumerDTO } from "../db/dto/consumer.dto";
import { services } from "../db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import HttpError from "../utils/http-error";

/**
 * Interceptor for handling consumer request authentication.
 * Ensures that incoming requests have a valid token for authentication.
 */
export default class Auth {
  private static UNKEY_VERIFY_URL = process.env.UNKEY_VERIFY_URL;
  private static API_ID = process.env.TAOSHI_API_KEY;
  private static consumerCtrl = new ConsumerCtrl();

  /**
   * Verifies the provided token with Unkey or a custom authentication service.
   * @param {string} token - The token to verify.
   * @returns {Promise<boolean>} - A promise that resolves to true if the token is verified, otherwise false.
   */
  public static async verifyRequest(
    req: Request,
    res: Response,
    next: NextFunction,
    { type }: { type: string }
  ): Promise<Partial<ConsumerDTO> | boolean | any> {
    const token = Auth.extractToken(req, { type });

    if (!token) {
      Logger.error("Unauthorized: No token provided");
      return res.status(401).json({ error: "Unauthorized: No token provided" });
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

      Logger.info(`Unkey Response: ${response?.data?.valid}`);

      const { keyId, meta: data } = response?.data as ConsumerDTO;

      if (!keyId) {
        return res
          .status(403)
          .send({ error: "Unauthorized: Invalid request key" });
      }

      const resp = await this.consumerCtrl.find(
        eq(services.consumerKeyId, keyId)
      );

      if (!resp?.data?.[0]) {
        return res
          .status(403)
          .send({ error: "Unauthorized: No services found" });
      }

      const { active, enabled, meta, endpointId } = resp
        ?.data?.[0] as ServiceDTO;

      if (!active) {
        return res
          .status(403)
          .send({ error: "Unauthorized: Subscription is not active" });
      }

      if (!enabled) {
        return res
          .status(403)
          .send({ error: "Unauthorized: Service is not enabled" });
      }

      if (!data?.shortId || data?.shortId !== meta?.shortId) {
        return res.status(403).send({ error: "Unauthorized: Id mismatch" });
      }

      if (!(data?.endpointId === endpointId)) {
        return res
          .status(403)
          .send({
            error: "Unauthorized: Endpoint unauthorized for this service",
          });
      }

      return response?.data;
    } catch (error: AxiosError | unknown) {
      next(error);
      return;
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
    if (req.headers[type]) {
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
