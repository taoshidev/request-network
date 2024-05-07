import { ethers } from "ethers";
import Logger from "../utils/logger";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";
import UpholdConnector from "./uphold.connector";
import ServiceManager from "./service.manager";
import BlockchainManager from "./blockchain.manager";
import { differenceInCalendarMonths, addDays } from "date-fns";
import { getConfig, setupTokenConfig } from "../utils/config";
import { transactions } from "../db/schema";
import { TransactionDTO } from "../db/dto/transaction.dto";
import DatabaseWrapper from "../core/database.wrapper";
import { eq, sum } from "drizzle-orm";
import { replacer } from "../utils/bigint-replacer";

interface TokenConfig {
  address: string;
  abi: ethers.InterfaceAbi;
  decimals: number;
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

  constructor() {
    super(transactions);

    Logger.info("Initializing TransactionManager...");
    try {
      this.provider = this.initializeWebSocketProvider();
      this.contracts = this.initializeContracts();
    } catch (error: Error | unknown) {
      Logger.error(
        `Failed to initialize Transaction Manager: ${(error as Error)?.message}`
      );
    }
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
      const { data: publicKeys } =
        await this.serviceManager.getDistinctValidatorWallets();

      this.monitorTransfers(
        undefined,
        publicKeys as Array<{ validatorWalletAddress: string } | undefined>
      );
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
  monitorTransfers(
    service?: ServiceWithWalletDTO | undefined,
    validatorErcAddresses?: Array<
      { validatorWalletAddress: string } | undefined
    >
  ): void {
    if (service) {
      const { consumerWalletAddress } = service;
      Logger.info(
        `Listening for Transfer events for wallet: ${consumerWalletAddress}`
      );
    } else if (validatorErcAddresses) {
      Logger.info(
        `Listening for Transfer events for validator wallet: ${JSON.stringify(
          validatorErcAddresses
        )}`
      );
    } else {
      Logger.info(`No wallet or validator erc-20 address provided.`);
    }
    Object.keys(this.contracts).forEach((tokenKey) => {
      // Remove any previously set listeners to avoid duplicates
      this.contracts[tokenKey].removeAllListeners("Transfer");
      // Listen to Transfer events specific to the current wallet
      this.contracts[tokenKey].on(
        "Transfer",
        async (from: string, to: string, amount: bigint, event: any) => {
          if (service) {
            // Log the transfer to and from escrow
            this.processTransferEvent(tokenKey, from, to, amount, service);
          } else if (validatorErcAddresses) {
            const publicKeys = (validatorErcAddresses || [])?.map(
              (k) => k?.validatorWalletAddress!
            );
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

      // Get the service associated with the consumer wallet address
      const currentService = await this.serviceManager.getSubscriberByAddress(
        from as string
      );

      const { data: subscription } = currentService;
      const { id } = subscription!;
      try {
        if (!subscription) return;

        // Track the transaction
        await this.trackTransactions(
          id!,
          to,
          tokenKey,
          from,
          to,
          amount,
          event
        );

        if (!subscription.active) {
          // return the balance to see if the balance is sufficient to activate the service
          const balance = await this.checkSubscriptionBalance(subscription);

          if (!balance) return;
          const { sufficient, balance: newBalance } = balance;
          Logger.info(
            `Funds Check for Service ID ${id}: ${
              sufficient ? "Sufficient" : "Insufficient"
            } Balance: ${newBalance}`
          );

          if (sufficient) {
            await this.serviceManager.changeStatus(id as string, true);
            Logger.info(`Service ID ${id} activated.`);
          }
        }
      } catch (error) {
        Logger.error(
          `Error handling funds transfer for Service ID ${id}: ${error}`
        );
      }
    }
  }

  async checkSubscriptionBalance(service: ServiceWithWalletDTO): Promise<{
    sufficient: boolean;
    balance: string;
    gracePeriod: boolean;
    message?: string;
  } | void> {
    if (
      service.id &&
      service.consumerWalletAddress &&
      service.validatorWalletAddress &&
      service.price &&
      service.createdAt
    ) {
      const data = await this.blockchainManager.getTokenBalances(
        service.consumerWalletAddress
      );

      const balance = data.usdc as string;

      const startDate = new Date(service.createdAt);
      const now = new Date();
      const monthsPassed =
        Math.max(differenceInCalendarMonths(now, startDate), 0) + 1;

      const totalAmountDue = monthsPassed * parseFloat(service.price);

      const totalDeposits = await this.getTotalDeposits(service.id);
      const outstandingBalance = totalAmountDue - +totalDeposits;

      const sufficient = balance && parseFloat(balance) >= outstandingBalance;
      // Calculate grace period end date
      const graceEndDate = addDays(startDate, 40);
      const inGracePeriod = now <= graceEndDate;

      if (!sufficient) {
        if (inGracePeriod) {
          Logger.info(
            `Insufficient funds detected but within grace period for wallet ${service.consumerWalletAddress}. Balance: ${balance} USDC, Required: ${totalAmountDue} USDC.`
          );
          return {
            sufficient: false,
            balance,
            gracePeriod: true,
            message: "Currently in grace period.",
          };
        } else {
          Logger.info(
            `Insufficient funds and grace period has elapsed for wallet ${service.consumerWalletAddress}. Setting active flag to false.`
          );

          await this.serviceManager.changeStatus(service.id, false);

          return {
            sufficient: false,
            balance,
            gracePeriod: false,
            message: "Subscription cancelled after grace period.",
          };
        }
      }

      Logger.info(
        `Sufficient funds detected for wallet ${service.consumerWalletAddress}: ${balance} USDC`
      );

      return { sufficient, balance, gracePeriod: inGracePeriod };
    }
  }

  async trackTransactions(
    serviceId: string,
    walletAddress: string,
    tokenContract: string,
    from: string,
    to: string,
    amount: bigint,
    event: any
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
      Logger.info(`Transaction saved: ${JSON.stringify(transaction)}`);
    } catch (error) {
      Logger.error(`Error saving transaction: ${JSON.stringify(error)}`);
    }
  }

  async updateTransactionConfirmation(
    transactionHash: string,
    isConfirmed: boolean
  ) {
    await this.updateSet(
      { confirmed: isConfirmed },
      eq(transactions.transactionHash, transactionHash)
    );
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
        this.updateTransactionConfirmation(transaction?.transactionHash!, true);
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
}
