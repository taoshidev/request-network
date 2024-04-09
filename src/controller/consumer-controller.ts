import { Request, Response } from "express";
import { ServiceDTO } from "../db/dto/service-dto.js";
import { services } from "../db/schema.js";
import { BaseController } from "../core/base-controller.js";
import axios, { AxiosError } from "axios";
import Logger from "../utils/logger.js";
import { CustomRequestDTO } from "../db/dto/custom-request-dto.js";
import { ConsumerDTO } from "../db/dto/consumer-dto.js";

/**
 * Controller for handling consumer-specific actions.
 * This includes registering new consumers and forwarding consumer requests to validators.
 */
export default class ConsumerCtrl extends BaseController {
  constructor() {
    super(services);
  }

  /**
   * Handles the registration of a new consumer by saving their information in the database.
   * @param {Request} req - Express.js request object containing the consumer information in the body.
   * @param {Response} res - Express.js response object.
   * @param {NextFunction} next - Express.js next middleware function.
   * @returns A 201 status code and the created consumer data on success, or a 400 status code with an error message on failure.
   * payload = {
   *    type: "consumer",
   *    rnConsumerRequestKey: "req-consumer-key",
   *    rnValidatorApiKey: "validator-api-id",
   *    rnValidatorHotkey: "validator-hotkey",
   *    rnValidatorMeta: {
   *      subnetId: "123456789",
   *      endpoint: "http://localhost:3000",
   *    },
   *  };
   */
  handleConsumerRegistration = async (req: Request, res: Response) => {
    if (!req?.body)
      return res.status(400).json({ error: "Request missing payload" });
    const { data, error } = await this.create(req.body as ServiceDTO);

    if (error) {
      return res.status(400).json({ error: error?.message });
    }

    return res.status(201).json(data);
  };

  /**
   * Forwards a consumer request to a validator's output server and returns the response back to the consumer.
   * @param {Request} req - Express.js request object, containing the data to forward to the validator.
   * @param {Response} res - Express.js response object.
   * @returns The response from the validator to the consumer. A 500 status code is returned in case of an error.
   */
  handleRequestToValidator = async (req: CustomRequestDTO, res: Response) => {
    const { consumer, body: data } = req;
    const { valid, enabled, name, keyId, meta } = consumer as ConsumerDTO;

    if (!valid)
      return res.status(400).json({ error: "Consumer is not valid." });
    if (!enabled)
      return res.status(400).json({ error: "Consumer is not enabled." });

    Logger.info(
      `Consumer ${name} is forwarding request to validator ${meta?.validatorId} at ${meta?.customEndpoint}`
    );

    const url =
      process.env.NODE_ENV === "development"
        ? "http://localhost:8080/api/v1/services"
        : meta?.customEndpoint;

    ["host", "content-length", "connection"].forEach(
      (key) => delete req.headers[key]
    );

    const headers = Object.assign({}, req.headers, {
      "Content-Type": "application/json",
      "x-taoshi-validator-request-key": keyId,
    });

    // NOTE: We are sending the request directly to our local api server in development mode, so that it can be debugged locally.
    // Since our server is locked down, we need to mock this header for local development purposes.
    // In production mode, the validator will be running on their production server, and this endpoint will be proxy to it.
    if (process.env.NODE_ENV) {
      headers["x-taoshi-request-key"] = keyId;
    }

    Logger.info(`Consumer: ${consumer}`);

    try {
      // Forward the request to the validator's output server
      const resp = await axios({
        method: "GET",
        url,
        data,
        headers,
      });

      // Return the response from the validator back to the consumer
      res.status(resp.status).json(resp.data);
    } catch (error: AxiosError | unknown) {
      Logger.error(
        `Error forwarding request to validator: ${
          (error as AxiosError)?.response?.statusText
        }`
      );
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
