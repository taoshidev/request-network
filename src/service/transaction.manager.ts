import { ethers } from "ethers";
import Logger from "../utils/logger";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";
import UpholdConnector from "./uphold.connector";
import ServiceManager from "./service.manager";
import BlockchainManager from "./blockchain.manager";
import {
  differenceInCalendarMonths,
  differenceInDays,
  setDate,
  isAfter,
} from "date-fns";
import { getConfig, setupTokenConfig } from "../utils/config";
import { transactions } from "../db/schema";
import { TransactionDTO } from "../db/dto/transaction.dto";
import DatabaseWrapper from "../core/database.wrapper";
import { eq, sum } from "drizzle-orm";
import { replacer } from "../utils/bigint-replacer";
import { ServiceDTO } from "../db/dto/service.dto";
import {
  AuthenticatedRequest,
  XTaoshiHeaderKeyType,
} from "../core/auth-request";

interface TokenConfig {
  address: string;
  abi: ethers.InterfaceAbi;
  decimals: number;
}

export enum SERVICE_STATUS_TYPE {
  NEW = "new",
  IN_GRACE_PERIOD = "in grace period",
  ON_TIME = "on time",
  DELINQUENT = "delinquent",
  CANCELLED = "cancelled",
}

/**
 * Token configurations including Ethereum contract address and ABI.
 */
export const TOKENS: Record<string, TokenConfig> = setupTokenConfig();

/**
 * Class responsible for monitoring blockchain transactions for specified tokens and wallets.
 */
export default class TransactionManager extends DatabaseWrapper<TransactionDTO> {
  private upholdConnector: UpholdConnector = new UpholdConnector();
  private serviceManager: ServiceManager = new ServiceManager();
  private blockchainManager: BlockchainManager = new BlockchainManager();
  private provider!: ethers.WebSocketProvider;
  private contracts!: Record<string, ethers.Contract>;

  private validatorWallets: Set<string> = new Set();
  private static instance: TransactionManager;

  constructor() {
    super(transactions);

    Logger.info("Initializing TransactionManager...");
    try {
      if (
        process.env.INFURA_PROJECT_ID &&
        (!process.env.ROLE || process.env.ROLE === "cron_handler")
      ) {
        this.provider = this.initializeWebSocketProvider();
        this.contracts = this.initializeContracts();
      }
    } catch (error: Error | unknown) {
      Logger.error(
        `Failed to initialize Transaction Manager: ${(error as Error)?.message}`
      );
    }
  }

  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  /**
   * Initializes a WebSocket provider connected to the appropriate network.
   * @returns A WebSocket provider.
   */
  private initializeWebSocketProvider(): ethers.WebSocketProvider {
    const { network, infuraProjectId } = getConfig();

    const wsURL = `wss://${network}.infura.io/ws/v3/${infuraProjectId}`;
    this.provider = new ethers.WebSocketProvider(wsURL);

    this.provider.on("network", (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        Logger.info(`Switched from ${oldNetwork.name} to ${newNetwork.name}`);
      } else {
        Logger.info(`Connected to ${newNetwork.name}`);
      }
    });

    this.provider.on("error", (error: Error) => {
      Logger.error(`WebSocket Error: ${error.message}`);
      this.handleWebSocketError();
    });

    this.provider.on("block", async (blockNumber) => {
      Logger.info(`New block: ${blockNumber}`);
      try {
        await this.checkPendingTransactionsConfirmations();
      } catch (error) {
        Logger.error(`Failed to check transactions: ${error}`);
      }
    });

    return this.provider;
  }

  handleWebSocketError(): void {
    setTimeout(() => {
      Logger.info("Reconnecting WebSocket...");
      this.provider = this.initializeWebSocketProvider();
      this.contracts = this.initializeContracts();
      this.monitorValidatorWallets();
    }, 5000);
  }

  /**
   * Initializes contracts for the specified tokens.
   * @returns A record of contracts keyed by token name.
   */
  initializeContracts(): Record<string, ethers.Contract> {
    const contracts: Record<string, ethers.Contract> = {};
    for (const tokenKey in TOKENS) {
      contracts[tokenKey] = new ethers.Contract(
        TOKENS[tokenKey].address,
        TOKENS[tokenKey].abi,
        this.provider
      );
    }
    return contracts;
  }

  async monitorAllWallets(): Promise<void> {
    try {
      const services = await new ServiceManager()
        .getSubscriptions({ inclusive: true })
        .then((res) => res.data as ServiceWithWalletDTO[]);

      services.forEach((service) => {
        this.monitorTransfers(service);
      });
    } catch (error) {
      Logger.error(
        `Failed to monitor all wallets: JSON: ${JSON.stringify(error, null, 2)}`
      );
    }
  }

  async monitorValidatorWallets(): Promise<void> {
    try {
      this.monitorTransfers(undefined);
    } catch (error) {
      Logger.error(
        `Failed to monitor all wallets: JSON: ${JSON.stringify(error, null, 2)}`
      );
    }
  }

  /**
   * Monitors transfer events for a specific wallet address.
   * @param walletAddress The wallet address to monitor for transfers.
   */
  monitorTransfers(service?: ServiceWithWalletDTO | undefined): void {
    const publicKeys = Array.from(this.validatorWallets);

    if (service) {
      const { consumerWalletAddress } = service;
      Logger.info(
        `Listening for Transfer events for wallet: ${consumerWalletAddress}`
      );
    } else if (publicKeys) {
      Logger.info(
        `Monitoring validator wallets: ${Array.from(this.validatorWallets).join(
          ", "
        )}`
      );
    } else {
      Logger.info(`No wallet or validator erc-20 address provided.`);
    }
    Object.keys(this.contracts).forEach((tokenKey) => {
      if (!this.validatorWallets.size) {
        this.contracts[tokenKey].removeAllListeners("Transfer");
      }
      this.contracts[tokenKey].on(
        "Transfer",
        async (from: string, to: string, amount: bigint, event: any) => {
          if (service) {
            this.processTransferEvent(tokenKey, from, to, amount, service);
          } else {
            this.processConsumerDepositEvent(
              tokenKey,
              from,
              to,
              amount,
              publicKeys,
              event
            );
          }
        }
      );
    });
  }

  async processTransferEvent(
    tokenKey: string,
    from: string,
    to: string,
    amount: bigint,
    service: ServiceWithWalletDTO
  ): Promise<void> {
    const { validatorWalletAddress, id } = service;
    if (from === validatorWalletAddress) {
      Logger.info(
        `${tokenKey} Transferred | From: ${from} To: ${to} Amount: ${ethers.formatUnits(
          amount,
          6
        )}`
      );
    }
    if (to === validatorWalletAddress) {
      Logger.info(
        `${tokenKey} Received | From: ${from} To: ${to} Amount into Escrow: ${ethers.formatUnits(
          amount,
          6
        )} ${tokenKey}`
      );

      try {
        const currentService = await this.serviceManager.getSubscription(
          id as string
        );
        const { data: subscription } = currentService;

        if (!subscription) return;

        if (!subscription.active) {
          const balance = await this.upholdConnector.checkSubscriptionBalance(
            subscription
          );

          if (!balance) return;
          const { sufficient, balance: newBalance } = balance;
          Logger.info(
            `Funds Check for Service ID ${id}: ${
              sufficient ? "Sufficient" : "Insufficient"
            } Balance: ${newBalance}`
          );

          if (sufficient) {
            const res = await this.upholdConnector.handleFundsTransfer(
              subscription
            );

            if (res) {
              await this.serviceManager.changeStatus(id as string, true);
              Logger.info(`Service ID ${id} activated.`);
            }
          }
        }
      } catch (error) {
        Logger.error(
          `Error handling funds transfer for Service ID ${id}: ${error}`
        );
      }
    }
  }

  async processConsumerDepositEvent(
    tokenKey: string,
    from: string,
    to: string,
    amount: bigint,
    publicKeys: string[],
    event: any
  ): Promise<void> {
    if (publicKeys.includes(from)) {
      Logger.info(
        `${tokenKey} Transferred | From Validator ERC-20 Account: ${from} To Consumer ERC-20 Account: ${to} Amount: ${ethers.formatUnits(
          amount,
          6
        )}`
      );
    }
    if (publicKeys.includes(to)) {
      Logger.info(
        `${tokenKey} Received | From Consumer ERC-20 Account: ${from} To Validator: ${to} Amount into Validator ERC-20 Account: ${ethers.formatUnits(
          amount,
          6
        )} ${tokenKey}`
      );

      const currentService = await this.serviceManager.getSubscriberByAddress(
        from as string
      );

      const { data: subscription } = currentService;
      const { id } = subscription!;
      try {
        if (!subscription) return;

        await this.trackTransactions(
          id!,
          to,
          tokenKey,
          from,
          to,
          amount,
          event,
          subscription
        );

        const result = await this.checkSubscriptionBalance(subscription);

        if (!result) return;
        const { status } = result;
        Logger.info(`Funds Check for Service ID ${id}: ${status}`);

        if (!subscription.active) {
          await this.serviceManager.changeStatus(id as string, true);
          Logger.info(`Payment success! Service ID ${id} activated.`);
        }
      } catch (error) {
        Logger.error(
          `Error handling funds transfer for Service ID ${id}: ${error}`
        );
      }
    }
  }

  async checkSubscriptionBalance(service: ServiceWithWalletDTO): Promise<{
    status: string;
    gracePeriod: boolean;
  } | void> {
    if (
      service.id &&
      service.consumerWalletAddress &&
      service.validatorWalletAddress &&
      service.price &&
      service.createdAt
    ) {
      const startDate = new Date(service.createdAt);
      const now = new Date();

      const registrationDay = startDate.getDate();
      const lastDueDate = setDate(now, registrationDay);

      if (isAfter(lastDueDate, now)) {
        lastDueDate.setMonth(lastDueDate.getMonth() - 1);
      }

      const monthsPassed =
        Math.max(differenceInCalendarMonths(now, startDate), 0) + 1;
      const totalAmountDue = monthsPassed * parseFloat(service.price);
      const totalDeposits = await this.getTotalDeposits(service.id);
      const outstandingBalance = totalAmountDue - +totalDeposits;

      const daysPassDue = differenceInDays(now, lastDueDate);
      const inGracePeriod = daysPassDue <= 14;
      let active = service.active;
      let serviceStatusType = service.serviceStatusType as string;

      if (outstandingBalance > 0) {
        if (inGracePeriod) {
          serviceStatusType = SERVICE_STATUS_TYPE.IN_GRACE_PERIOD;
        } else if (daysPassDue > 14) {
          serviceStatusType = SERVICE_STATUS_TYPE.DELINQUENT;
          active = false;
        }
      }

      if (outstandingBalance <= 0) {
        serviceStatusType = SERVICE_STATUS_TYPE.ON_TIME;
        active = true;
      }

      if (daysPassDue >= 30) {
        serviceStatusType = SERVICE_STATUS_TYPE.CANCELLED;
        active = false;
      }

      const { data: updatedService, error } = await this.serviceManager.update(
        service?.id,
        {
          outstandingBalance,
          daysPassDue,
          serviceStatusType,
          active,
        } as ServiceDTO
      );

      // Request to the UI app to trigger a notification to the consumer and validator notifying them about the status change.
      await AuthenticatedRequest.send({
        method: "POST",
        path: "/api/notify/payment",
        body: {
          subscriptionId: service?.subscriptionId,
          serviceStatusType,
          eventType: "balance-checked",
        },
        xTaoshiKey: XTaoshiHeaderKeyType.Validator,
      });

      if (inGracePeriod) {
        Logger.info(
          `Within grace period for wallet ${service.consumerWalletAddress}.`
        );
        return {
          status: serviceStatusType,
          gracePeriod: true,
        };
      }

      if (serviceStatusType === SERVICE_STATUS_TYPE.CANCELLED) {
        Logger.info(
          `Grace period has elapsed for wallet ${service.consumerWalletAddress}. Setting active flag to false.`
        );
        return {
          status: serviceStatusType,
          gracePeriod: false,
        };
      }

      return {
        status: serviceStatusType,
        gracePeriod: inGracePeriod,
      };
    }
  }

  async trackTransactions(
    serviceId: string,
    walletAddress: string,
    tokenContract: string,
    from: string,
    to: string,
    amount: bigint,
    event: any,
    service: ServiceDTO
  ) {
    if (!event?.log) {
      throw new Error("Event log is not available");
    }
    const transactionType =
      to.toLowerCase() === walletAddress.toLowerCase()
        ? "deposit"
        : "withdrawal";

    const transaction = {
      serviceId,
      walletAddress,
      transactionHash: event?.log?.transactionHash || "Unknown Hash",
      fromAddress: from,
      toAddress: to,
      amount: ethers.formatUnits(amount, TOKENS[tokenContract].decimals),
      transactionType: transactionType as "deposit" | "withdrawal",
      blockNumber: event?.log?.blockNumber || -1,
      tokenAddress: tokenContract,
      meta: JSON.stringify(
        {
          transactionIndex: event?.log?.transactionIndex,
          blockHash: event?.log?.blockHash,
        },
        replacer
      ),
    };

    try {
      await this.create(transaction);

      // Send a request to the UI app to trigger a notification to the validator saying payment has been initiated.
      await AuthenticatedRequest.send({
        method: "POST",
        path: "/api/notify/payment",
        body: {
          subscriptionId: service?.subscriptionId,
          serviceStatusType: service?.serviceStatusType,
          eventType: "transaction-checked",
        },
        xTaoshiKey: XTaoshiHeaderKeyType.Validator,
      });

      Logger.info(`Transaction saved: ${JSON.stringify(transaction)}`);
    } catch (error) {
      Logger.error(`Error saving transaction: ${JSON.stringify(error)}`);
    }
  }

  async updateTransactionConfirmation(
    transaction: TransactionDTO,
    isConfirmed: boolean
  ) {
    await this.updateSet(
      { confirmed: isConfirmed },
      eq(transactions.transactionHash, transaction?.transactionHash!)
    );
    // Send a request to the UI app to trigger a notification to the consumer saying payment has been received and confirmed.
    // Also, send a notification to the validator saying payment has been made.
    const currentService = await this.serviceManager.getSubscriberByAddress(
      transaction?.walletAddress as string
    );
    const { data: service } = currentService;

    await AuthenticatedRequest.send({
      method: "POST",
      path: "/api/notify/payment",
      body: {
        subscriptionId: service?.subscriptionId,
        serviceStatusType: service?.serviceStatusType,
        eventType: "transaction-confirmed",
      },
      xTaoshiKey: XTaoshiHeaderKeyType.Validator,
    });
  }

  async checkPendingTransactionsConfirmations() {
    // Get pending transactions from your database
    Logger.info("Checking pending transactions confirmations...");
    const pendingTransactions = await this.find(
      eq(transactions.confirmed, false)
    );

    // Check each transaction
    for (const transaction of pendingTransactions?.data!) {
      const confirmed = await this.blockchainManager.verifyTransaction(
        transaction?.transactionHash!
      );

      if (confirmed) {
        this.updateTransactionConfirmation(transaction, true);
        Logger.info(
          `Transaction ${transaction?.transactionHash!} is confirmed.`
        );
      }
    }
  }

  async getTotalDeposits(serviceId: string): Promise<number | string> {
    const transaction = await this.find(eq(transactions.serviceId, serviceId), {
      totalDeposits: sum(transactions.amount),
    });
    return transaction?.data?.[0]?.totalDeposits || 0;
  }

  public startMonitoring() {
    this.updateValidatorWallets();
  }

  public async updateValidatorWallets(): Promise<void> {
    try {
      const { data: publicKeys } =
        await this.serviceManager.getDistinctValidatorWallets();
      (
        (publicKeys as Array<{ validatorWalletAddress: string } | undefined>) ||
        []
      ).forEach((key) => {
        if (key && key?.validatorWalletAddress) {
          this.validatorWallets.add(key?.validatorWalletAddress);
        }
      });

      this.monitorValidatorWallets();
    } catch (error) {
      Logger.error(
        `Failed to update validator wallets: JSON: ${JSON.stringify(
          error,
          null,
          2
        )}`
      );
    }
  }
}
