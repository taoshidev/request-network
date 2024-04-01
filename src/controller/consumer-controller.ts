import { Request, Response, NextFunction } from "express";
import { ServiceDTO } from "../db/dto/service-dto.js";
import { services } from "../db/schema.js";
import { BaseController } from "../core/base-controller.js";
import axios from "axios";

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
   *    rnValidatorApiId: "validator-api-id",
   *    rnValidatorHotkey: "validator-hotkey",
   *    rnValidatorMeta: {
   *      subnetId: "123456789",
   *      endpoint: "http://localhost:3000",
   *    },
   *  };
   */
  handleConsumerRegistration = async (
    req: Request,
    res: Response,
    next?: NextFunction
  ) => {
    const { consumerInfo } = req.body;
    const { data, error } = await this.create(consumerInfo as ServiceDTO);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(data);
  };

  /**
   * Forwards a consumer request to a validator's output server and returns the response back to the consumer.
   * @param {Request} req - Express.js request object, containing the data to forward to the validator.
   * @param {Response} res - Express.js response object.
   * @returns The response from the validator to the consumer. A 500 status code is returned in case of an error.
   */
  handleRequestToValidator = async (req: Request, res: Response, next?: NextFunction) => {
    const validatorEndpoint = "http://localhost:8080/api/v1/services"; // TODO: replace with validator endpoint

    try {
      // Forward the request to the validator's output server
      const validatorResponse = await axios({
        method: "GET", // TODO: replace with validator request method
        url: validatorEndpoint,
        data: req.body,
        headers: {
          "Content-Type": "application/json",
          "x-taoshi-validator-request-key": "req-validator-key", // TODO: replace with validator request key
          /* ... */
        },
      });

      // Return the response from the validator back to the consumer
      res.status(validatorResponse.status).json(validatorResponse.data);
    } catch (error) {
      console.error("Error forwarding request to validator:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
