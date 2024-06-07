import { Request, Response } from "express";
import { ServiceDTO } from "../db/dto/service.dto";
import { services } from "../db/schema";
import BaseController from "../core/base.controller";
import Logger from "../utils/logger";
import { CustomRequestDTO } from "../db/dto/custom-request.dto";
import TransactionManager from "../service/transaction.manager";
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
   */
  handleConsumerRegistration = async (req: Request, res: Response) => {
    const { body } = req as CustomRequestDTO;
    if (!body)
      return res.status(400).json({ error: "Request missing payload" });

    try {
      const { data, error } = await this.create(body as ServiceDTO);

      if (error) {
        return res.status(400).json({ error: error?.message });
      }

      if (
        process.env.INFURA_PROJECT_ID &&
        (!process.env.ROLE || process.env.ROLE === "cron_handler")
      ) {
        // Get the transaction manager instance
        const transactionManager = TransactionManager.getInstance();
        // Update the validator wallets in the transaction manager
        transactionManager.updateValidatorWallets().catch((error) => {
          Logger.error(
            `Failed to update validator wallets after new service creation: ${JSON.stringify(
              error,
              null,
              2
            )}`
          );
        });
      }

      // Respond with the new serviceId
      return res.status(201).json({ serviceId: data?.[0].id });
    } catch (error: Error | unknown) {
      Logger.error("Error registering consumer:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  };
}
