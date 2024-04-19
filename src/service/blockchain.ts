import { ethers } from "ethers";
import Logger from "../utils/logger";

/**
 * Blockchain class provides methods to interact with blockchain technologies.
 * It includes creating and managing wallets which can be used for creating escrow accounts and managing payment activities.
 */
export class Blockchain {
  private provider: ethers.WebSocketProvider;

  constructor() {
    this.provider = new ethers.WebSocketProvider(
      process.env.NODE_ENV === "development"
        ? `wss://sepolia.infura.io/ws/v3/${process.env.INFURA_PROJECT_ID}`
        : `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_PROJECT_ID}`
    );
  }

  /**
   * Creates an escrow wallet derived from a provided private key.
   * This method use a private key to generate a new wallet.
   * @param {string} privateWalletKey - The validator's private key in a secure hexadecimal string.
   * @returns {ethers.Wallet} A new wallet object representing the escrow wallet.
   */
  static createEscrowWallet(privateWalletKey: string): ethers.Wallet {
    const formattedPrivateKey = privateWalletKey.startsWith("0x")
      ? privateWalletKey
      : `0x${privateWalletKey}`;
    return new ethers.Wallet(formattedPrivateKey);
  }

  /**
   * Monitors all pending blockchain transactions for a specified address.
   * This method subscribes to the 'pending' events on the Ethereum blockchain and checks
   * if the incoming or outgoing transaction involves the specified address.
   *
   * @param {string} address - The Ethereum address to monitor for transactions.
   * @returns {Promise<void>} A promise that resolves when the method is set up and continues to listen indefinitely.
   *
   * @example
   * ```
   * const blockchain = new Blockchain();
   * blockchain.monitorTransactions('0x1234567890123456789012345678901234567890');
   * ```
   *
   * - TODO: Test and setup cron tasks to run. Additional logic needed
   * - TODO: Monitor for pending transactions. Send data to UI application
   */
  async monitorTransactions(walletAddress: string): Promise<void> {
    this.provider.on("pending", async (txHash) => {
      try {
        const tx = await this.getTransaction(txHash);
        if (tx && (tx.from === walletAddress || tx.to === walletAddress)) {
          const receipt = await this.getTransactionReceipt(txHash);
          Logger.info("Detailed transaction info:");
          Logger.info(`Transaction Hash: ${tx.hash}`);
          Logger.info(`Gas Limit: ${tx.gasLimit.toString()}`);
          Logger.info(`Gas Used: ${receipt?.gasUsed.toString()}`);
          Logger.info(`Base Fee: ${receipt?.fee}`);
        }
      } catch (error) {
        Logger.error(`Error monitoring transaction: ${error}`);
      }
    });

    this.provider.on("error", (error) => {
      Logger.error(`WebSocket Error: ${JSON.stringify(error)}`);
    });
  }

  async getTransaction(txHash: string, attempt = 1): Promise<any> {
    const maxRetries = 3;
    const delay = 2000;

    try {
      const tx = await this.provider.getTransaction(txHash);
      if (tx) return tx;
    } catch (error) {
      Logger.error(
        `Attempt ${attempt}: Error retrieving transaction - ${JSON.stringify(
          error
        )}`
      );

      if (attempt < maxRetries) {
        Logger.info(`Waiting ${delay / 1000} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.getTransaction(txHash, attempt + 1);
      } else {
        Logger.error("Max retries reached. Giving up.");
        throw error;
      }
    }
  }

  async getBlockchainData(
    walletAddress: string
  ): Promise<{ block: ethers.Block | null; txCount: number; balance: bigint }> {
    // Get latest block
    const block = await this.provider.getBlock("latest");
    Logger.info(`Latest block: ${block}`);

    // Get transaction count for an address
    const txCount = await this.provider.getTransactionCount(walletAddress);
    Logger.info(
      `Number of transactions for address ${walletAddress}: ${txCount}`
    );

    // Read balance
    const balance = await this.provider.getBalance(walletAddress);
    Logger.info(
      `Balance for address ${walletAddress}: ${ethers.formatEther(balance)} ETH`
    );
    return {
      block,
      txCount,
      balance,
    };
  }

  async getTransactionReceipt(txHash: string, retries = 3) {
    while (retries > 0) {
      try {
        return await this.provider.getTransactionReceipt(txHash);
      } catch (error) {
        retries--;
        Logger.error(
          `Attempt ${
            3 - retries
          }: Error fetching transaction receipt for ${txHash}: ${error}`
        );
        if (retries <= 0) {
          Logger.error(
            "Max retries reached, unable to fetch transaction receipt. Giving up."
          );
          throw new Error(
            "Max retries reached, unable to fetch transaction receipt"
          );
        }
        Logger.info(`Retrying after 2 seconds... Retries left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}
