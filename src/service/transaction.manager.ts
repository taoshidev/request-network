import { ethers } from "ethers";
import Logger from "../utils/logger";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";
import UpholdConnector from "./uphold.connector";
import ServiceManager from "./service.manager";

interface TokenConfig {
  address: string;
  abi: ethers.InterfaceAbi;
  decimals: number;
}

/**
 * Addresses for the tokens on different networks.
 */
const ADDRESSES = {
  production: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0CE3606EB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  development: {
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    USDT: "0x3E3fE2b5cF8c087bE77Df9B7f5269cF2fcB6B157",
  },
};

/**
 * Token configurations including Ethereum contract address and ABI.
 */
export const TOKENS: Record<string, TokenConfig> = {
  USDC: {
    decimals: 6,
    address:
      process.env.NODE_ENV === "development"
        ? ADDRESSES.development.USDC
        : ADDRESSES.production.USDC,
    abi: [
      "event Transfer(address indexed from, address indexed to, uint amount)",
      "function decimals() view returns (uint8)",
    ],
  },
  USDT: {
    decimals: 6,
    address:
      process.env.NODE_ENV === "development"
        ? ADDRESSES.development.USDT
        : ADDRESSES.production.USDT,
    abi: [
      "event Transfer(address indexed from, address indexed to, uint amount)",
      "function decimals() view returns (uint8)",
    ],
  },
};

/**
 * Class responsible for monitoring blockchain transactions for specified tokens and wallets.
 */
export default class TransactionManager {
  private upholdConnector: UpholdConnector;
  private serviceManager: ServiceManager;
  provider: ethers.WebSocketProvider;
  contracts: Record<string, ethers.Contract>;
  services: ServiceWithWalletDTO[] = [];

  constructor(services: ServiceWithWalletDTO[]) {
    Logger.info("Initializing TransactionManager...");
    this.upholdConnector = new UpholdConnector();
    this.serviceManager = new ServiceManager();
    this.services = services;
    this.provider = this.initializeWebSocketProvider();
    this.contracts = this.initializeContracts();
    this.monitorAllWallets();
  }

  /**
   * Initializes a WebSocket provider connected to the appropriate network.
   * @returns A WebSocket provider.
   */
  initializeWebSocketProvider(): ethers.WebSocketProvider {
    const network =
      process.env.NODE_ENV === "development" ? "sepolia" : "mainnet";
    const wsURL = `wss://${network}.infura.io/ws/v3/${process.env.INFURA_PROJECT_ID}`;
    const provider = new ethers.WebSocketProvider(wsURL);

    provider.on("network", (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        Logger.info(`Switched from ${oldNetwork.name} to ${newNetwork.name}`);
      } else {
        Logger.info(`Connected to ${newNetwork.name}`);
      }
    });

    provider.on("error", (error: Error) => {
      Logger.error(`WebSocket Error: ${error.message}`);
      this.handleWebSocketError();
    });

    return provider;
  }

  handleWebSocketError(): void {
    setTimeout(() => {
      Logger.info("Reconnecting WebSocket...");
      this.provider = this.initializeWebSocketProvider();
      this.contracts = this.initializeContracts();
      this.monitorAllWallets();
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

  monitorAllWallets(): void {
    this.services?.forEach((service) => {
      this.monitorTransfers(service);
    });
  }

  /**
   * Monitors transfer events for a specific wallet address.
   * @param walletAddress The wallet address to monitor for transfers.
   */
  monitorTransfers(service: ServiceWithWalletDTO): void {
    const { publicKey, id } = service;
    Logger.info(`Listening for Transfer events for wallet: ${publicKey}`);
    Object.keys(this.contracts).forEach((tokenKey) => {
      // Remove any previously set listeners to avoid duplicates
      this.contracts[tokenKey].removeAllListeners("Transfer");

      // Listen to Transfer events specific to the current wallet
      this.contracts[tokenKey].on(
        "Transfer",
        async (from: string, to: string, amount: bigint, event: any) => {
          // Log the transfer to and from escrow
          if (from === publicKey) {
            Logger.info(
              `${tokenKey} Transferred | From: ${from} To: ${to} Amount: ${ethers.formatUnits(
                amount,
                6
              )}`
            );
          }
          if (to === publicKey) {
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
                const balance =
                  await this.upholdConnector.checkSubscriptionBalance(
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
      );
    });
  }
}
