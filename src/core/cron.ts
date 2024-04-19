import { Blockchain } from "../service/blockchain";
import ServiceManager from "../service/service.manager";
import cron from "node-cron";
import Logger from "../utils/logger";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";

export default class ServiceCron {
  private blockchain: Blockchain;
  private serviceManager: ServiceManager;

  constructor() {
    this.blockchain = new Blockchain();
    this.serviceManager = new ServiceManager();
  }

  /**
   * Schedules a job to periodically check the blockchain balance for each active subscription.
   * This job is intended to run on the first of each month.
   */
  public run(): void {
    const cronExpression = "0 0 1 * *"; // Use "*/10 * * * * *" for testing
    cron.schedule(cronExpression, this.checkSubscriptions, {
      scheduled: true,
      timezone: "UTC",
    });
  }

  /**
   * Fetches active subscriptions and checks each one's blockchain balance. If the balance is zero,
   * deactivates the subscription.
   */
  private async checkSubscriptions(): Promise<void> {
    Logger.info("Running blockchain checks for all active subscriptions...");
    try {
      const subscriptions = await this.serviceManager.getActiveSubscriptions();
      if (!subscriptions?.data) {
        Logger.info("No active subscriptions found.");
        return;
      }

      for (const service of subscriptions.data) {
        await this.checkSubscriptionBalance(service);
      }
    } catch (error) {
      Logger.error(`Error during blockchain checks: ${error}`);
    }
  }

  /**
   * Checks the blockchain balance for a given subscription and deactivates it if the balance is zero.
   * @param service The subscription to check.
   */
  private async checkSubscriptionBalance(
    service: ServiceWithWalletDTO
  ): Promise<void> {
    if (!service.publicKey) {
      Logger.info(`Skipping subscription ${service.id} with no public key.`);
      return;
    }

    const data = await this.blockchain.getBlockchainData(service.publicKey);
    if (!data || data.balance === 0n) {
      Logger.info(
        `No funds found for wallet ${service.publicKey}. Setting active flag to false.`
      );
      await this.serviceManager.changeStatus(service.id as string, false);
    } else {
      Logger.info(
        `Funds detected for wallet ${service.publicKey}: ${data.balance}`
      );
      // TODO: Check if balance is sufficient to cover the monthly fee
      // Use uphold connector to convert to TAO and send to validator's wallet
    }
  }
}
