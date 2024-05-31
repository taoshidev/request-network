import ServiceManager from "../service/service.manager";
import UpholdConnector from "../service/uphold.connector";
import TransactionManager from "../service/transaction.manager";
import Logger from "../utils/logger";
import cron from "node-cron";

export default class ServiceCron {
  private serviceManager: ServiceManager;
  private upholdConnector: UpholdConnector;
  private transactionManager: TransactionManager;
  private static instance: ServiceCron;

  constructor() {
    this.serviceManager = new ServiceManager();
    this.upholdConnector = new UpholdConnector();
    this.transactionManager = TransactionManager.getInstance();
    this.checkSubscriptions = this.checkSubscriptions.bind(this);
    this.checkCryptoSubscriptions = this.checkCryptoSubscriptions.bind(this);
  }

  static getInstance(): ServiceCron {
    if (!ServiceCron.instance) {
      ServiceCron.instance = new ServiceCron();
    }
    return ServiceCron.instance;
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
    cron.schedule(cronExpression, () => this.checkCryptoSubscriptions(), {
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
      const subscriptions = await this.serviceManager.getSubscriptions();
      if (!subscriptions?.data) {
        Logger.info("No active subscriptions found.");
        return;
      }

      for (const service of subscriptions.data) {
        const balance = await this.upholdConnector.checkSubscriptionBalance(
          service
        );
        if (!balance) return;
        const { sufficient, balance: newBalance } = balance;
        if (sufficient) {
          await this.upholdConnector.handleFundsTransfer(service);
        } else {
          await this.serviceManager.changeStatus(service.id as string, false);
        }
      }
    } catch (error) {
      Logger.error(`Error during blockchain checks: ${error}`);
    }
  }

  private async checkCryptoSubscriptions(): Promise<void> {
    Logger.info(
      "Running monthly checks for all active Crypto subscriptions..."
    );
    try {
      const subscriptions = await this.serviceManager.getSubscriptions({
        currencyType: "Crypto",
      });

      if (!subscriptions?.data) {
        Logger.info("No active crypto subscriptions found.");
        return;
      }

      for (const service of subscriptions.data) {
        const result = await this.transactionManager.checkSubscriptionBalance(
          service
        );

        if (!result) return;
        const { status } = result;
        Logger.info(
          `Monthly crypto account check for service ${service.id}. status: ${status}`
        );
      }
    } catch (error) {
      Logger.error(`Error during blockchain checks: ${error}`);
    }
  }
}
