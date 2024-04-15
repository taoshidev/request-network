import { Request, Response } from "express";
import { ServiceDTO } from "../db/dto/service-dto";
import { services, wallets } from "../db/schema";
import { BaseController } from "../core/base-controller";
import axios, { AxiosError } from "axios";
import Logger from "../utils/logger";
import { CustomRequestDTO } from "../db/dto/custom-request-dto";
import { ConsumerDTO } from "../db/dto/consumer-dto";
import { BlockchainService } from "../core/blockchain-service";

/**
 * Controller for handling consumer-specific actions.
 * This includes registering new consumers and forwarding consumer requests to validators.
 */
export default class ConsumerCtrl extends BaseController {
  private wallet: BaseController;
  constructor() {
    super(services);
    this.wallet = new BaseController(wallets);
  }

  /**
   * Handles the registration of a new consumer by saving their information in the database.
   * @param {Request} req - Express.js request object containing the consumer information in the body.
   * @param {Response} res - Express.js response object.
   * @param {NextFunction} next - Express.js next middleware function.
   * @returns A 201 status code and the created consumer data on success, or a 400 status code with an error message on failure.
   */
  handleConsumerRegistration = async (req: Request, res: Response) => {
    if (!req?.body)
      return res.status(400).json({ error: "Request missing payload" });

    const validatorPrivateKey = process.env.VALIDATOR_WALLET_PRIVATE_KEY;
    if (!validatorPrivateKey) {
      return res
        .status(500)
        .json({ error: "Validator private key configuration is missing." });
    }

    try {
      const { data, error } = await this.create(req.body as ServiceDTO);

      if (error) {
        return res.status(400).json({ error: error?.message });
      }

      // Attempt to create an escrow wallet using the blockchain service
      const escrowWallet =
        BlockchainService.createEscrowWallet(validatorPrivateKey);
      // If successful, store the keys into the database wallets table
      const { error: walletError } = await this.wallet.create({
        serviceId: data?.[0].id,
        privateKey: escrowWallet.privateKey,
        publicKey: escrowWallet.address,
        active: true,
      });

      if (walletError) {
        return res.status(400).json({ error: walletError?.message });
      }

      // Respond with the public key of the escrow wallet
      return res.status(201).json({ ...data, publicKey: escrowWallet.address });
    } catch (error: Error | unknown) {
      Logger.error("Error registering consumer:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
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
    const outputServerUrl = process.env.VALIDATOR_OUTPUT_SERVER_API_URL;
    if (!valid)
      return res.status(400).json({ error: "Consumer is not valid." });
    if (!enabled)
      return res.status(400).json({ error: "Consumer is not enabled." });

    Logger.info(
      `Consumer ${name} is forwarding request to validator ${meta?.validatorId} at ${outputServerUrl}`
    );

    ["host", "content-length", "connection"].forEach(
      (key) => delete req.headers[key]
    );

    const headers = Object.assign({}, req.headers, {
      "Content-Type": "application/json",
      "x-taoshi-validator-request-key": keyId,
    });

    Logger.info(`Consumer: ${consumer}`);

    try {
      // Forward the request to the validator's output server
      const resp = await axios({
        method: "GET",
        url: outputServerUrl,
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
