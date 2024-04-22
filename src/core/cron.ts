import { Blockchain } from "../service/blockchain";
import ServiceManager from "../service/service.manager";
import UpholdConnector from "../service/uphold.connector";
import Logger from "../utils/logger";
import cron from "node-cron";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";

export default class ServiceCron {
  private blockchain: Blockchain;
  private serviceManager: ServiceManager;
  private upholdConnector: UpholdConnector;

  constructor() {
    this.blockchain = new Blockchain();
    this.serviceManager = new ServiceManager();
    this.upholdConnector = new UpholdConnector();
    this.checkSubscriptions = this.checkSubscriptions.bind(this);
  }

  /**
   * Schedules a job to periodically check blockchain balances for each active subscription
   * and deactivates any with zero balance or balance could not cover money fee.
   * This job is intended to run on the first of each month.
   */
  public run(): void {
    const cronExpression =
      // "*/60 * * * * *";
      "0 0 1 * *";
    cron.schedule(cronExpression, () => this.checkSubscriptions(), {
      scheduled: true,
      timezone: "UTC",
    });
  }

  /**
   * Fetches active subscriptions, checks their blockchain balances,
   * and deactivates any subscriptions whose balances are zero or below the subscription price.
   */
  private async checkSubscriptions(): Promise<void> {
    await this.upholdConnector.authenticate();
    Logger.info("Running monthly checks for all active subscriptions...");
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
   * Checks the blockchain balance for a given subscription and deactivates it if the balance is zero
   * or not enough to cover the price. Also handles the conversion and transfer of funds if sufficient.
   * @param {ServiceWithWalletDTO} service - The subscription service to check.
   */
  private async checkSubscriptionBalance(
    service: ServiceWithWalletDTO
  ): Promise<void> {
    if (
      service.id &&
      service.publicKey &&
      service.privateKey &&
      service.price
    ) {
      const data = await this.blockchain.getTokenBalances(service.publicKey);
      const usdcBalance = data.usdc;

      if (
        !usdcBalance ||
        parseFloat(usdcBalance) <= parseFloat(service.price)
      ) {
        Logger.info(
          `Insufficient funds in wallet ${service.publicKey}. Setting active flag to false.`
        );
        await this.serviceManager.changeStatus(service.id, false);
      } else {
        Logger.info(
          `Sufficient funds detected for wallet ${service.publicKey}: ${usdcBalance} USDC`
        );
        await this.handleFundsTransfer(service);
      }
    }
  }

  /**
   * Handles the transfer of funds from the service's wallet to an Uphold card, converts it to another currency,
   * and then sends it to a designated wallet.
   * @param {ServiceWithWalletDTO} service - The service with funds to transfer.
   */
  private async handleFundsTransfer(
    service: ServiceWithWalletDTO
  ): Promise<void> {
    const usdcCard = await this.upholdConnector.getCardByCurrency("USDC");
    const taoCard = await this.upholdConnector.getCardByCurrency("TAO");

    if (usdcCard && taoCard) {
      try {
        // Transfer USDC from the escrow wallet to the Uphold USDC card
        const transaction = await this.blockchain.sendTokens(
          service.privateKey as string,
          usdcCard.address.ethereum,
          service.price as string,
          "USDC"
        );

        // Convert USDC to TAO on Uphold
        const conversion = await this.upholdConnector.convertCurrency(
          usdcCard.id,
          { amount: service.price as string, currency: "USDC" },
          taoCard.id
        );

        // Withdraw TAO from the Uphold TAO card to the designated wallet
        if (conversion.destination.amount) {
          await this.upholdConnector.withdrawToAddress(
            taoCard.id,
            conversion.destination.amount,
            service.hotkey as string
          );
        }
      } catch (error) {
        Logger.error(
          `Failed to handle fund transfer for service ${service.id}: ${error}`
        );
      }
    }
  }
}
