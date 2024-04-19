import { HDNodeWallet, ethers } from "ethers";
import Logger from "../utils/logger";
import ServiceManager from "./service.manager";

export const TOKEN_TYPE = {
  USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
  USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
};

/**
 * Blockchain class provides methods to interact with blockchain technologies.
 * It includes creating and managing wallets which can be used for creating escrow accounts and managing payment activities.
 */
export class Blockchain {
  private wsProvider!: ethers.WebSocketProvider;
  private httpProvider!: ethers.JsonRpcProvider;
  private serviceManager: ServiceManager;
  private transactionQueue: string[] = [];
  private processedCount: number = 0;
  private errorCount: number = 0;
  private processingRate: number = 2000;

  constructor() {
    this.initializeProviders();
    this.processQueue();
    this.serviceManager = new ServiceManager();
  }

  private initializeProviders() {
    const providerOptions = {
      polling: false,
      batchStallTime: 50,
      batchMaxSize: 1024 * 1024,
      batchMaxCount: 1,
      cacheTimeout: 300000,
    };

    const network =
      process.env.NODE_ENV === "development" ? "sepolia" : "mainnet";
    const wsURL = `wss://${network}.infura.io/ws/v3/${process.env.INFURA_PROJECT_ID}`;
    const httpURL = `https://${network}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;

    this.wsProvider = new ethers.WebSocketProvider(
      wsURL,
      network,
      providerOptions
    );

    this.httpProvider = new ethers.JsonRpcProvider(httpURL, network, {
      ...providerOptions,
      batchMaxCount: 50,
    });

    this.wsProvider.websocket.close = () => {
      setTimeout(this.handleWebSocketError.bind(this), 5000);
    };
    this.wsProvider.websocket.onerror = (error) => {
      Logger.error(`WebSocket Error: ${error.message}`);
      setTimeout(this.handleWebSocketError.bind(this), 5000);
    };

    this.wsProvider.on("pending", (txHash) => {
      this.transactionQueue.push(txHash);
      Logger.info(`Transaction queued: ${txHash}`);
    });
  }

  private async processQueue() {
    setInterval(async () => {
      if (this.transactionQueue.length > 0) {
        const txHash = this.transactionQueue.shift();
        try {
          const transaction = await this.getTransaction(txHash!);
          this.processedCount++;
          Logger.info(`Transaction processed: ${transaction?.hash}`);
        } catch (error: any) {
          this.errorCount++;
          if (error.code === "RATE_LIMITED") {
            this.processingRate *= 2;
          }
          Logger.error(`Error processing transaction: ${error}`);
        } finally {
          Logger.info(
            `Queue Status: ${this.transactionQueue.length} remaining, ${this.processedCount} processed, ${this.errorCount} errors.`
          );
        }
      }
    }, this.processingRate);
  }

  private handleWebSocketError() {
    let retryCount = 0;
    const maxRetries = 5;

    const attemptReconnect = () => {
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          Logger.info(`Reconnecting WebSocket... Attempt ${retryCount + 1}`);
          this.initializeProviders();
          this.monitorPendingTransactions();
          retryCount++;
        }, delay);
      } else {
        Logger.error(
          "Maximum WebSocket reconnection attempts reached. Giving up."
        );
      }
    };

    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
    }
    attemptReconnect();
  }

  /**
   * Generates a new escrow wallet with a randomly created private key.
   * @returns {ethers.Wallet} A new wallet object representing the escrow wallet.
   */
  static createEscrowWallet(): ethers.Wallet | HDNodeWallet {
    const randomWallet = ethers.Wallet.createRandom();
    console.log(`New Escrow Wallet Address: ${randomWallet.address}`);
    return randomWallet;
  }

  async monitorPendingTransactions(): Promise<void> {
    const subscriptions = await this.serviceManager.getActiveSubscriptions();
    const walletAddresses = subscriptions.data?.map((s) => s.publicKey);
    (walletAddresses || []).forEach((a) =>
      this.monitorTransactions(a as string)
    );
  }

  /**
   * Monitors all pending blockchain transactions for a specified address.
   * This method subscribes to the 'pending' events on the Ethereum blockchain and checks
   * if the incoming or outgoing transaction involves the specified address.
   *
   * @param {string} walletAddress - The Ethereum address to monitor for transactions.
   * @returns {Promise<void>} A promise that resolves when the method is set up and continues to listen indefinitely.
   *
   * @example
   * ```
   * const blockchain = new Blockchain();
   * blockchain.monitorTransactions('0x1234567890123456789012345678901234567890');
   * ```
   *
   * - TODO: Monitor for pending transactions. Send data to UI application
   */
  private async monitorTransactions(walletAddress: string): Promise<void> {
    Logger.info(
      `Starting monitoring transactions for address: ${walletAddress}`
    );
    this.wsProvider.on("pending", async (txHash) => {
      this.queueTransaction(txHash, walletAddress);
    });
  }

  private async queueTransaction(txHash: string, walletAddress: string) {
    const tx = await this.getTransaction(txHash);
    if (tx && (tx.from === walletAddress || tx.to === walletAddress)) {
      this.transactionQueue.push(txHash);
      if (tx && (tx.from === walletAddress || tx.to === walletAddress)) {
        const receipt = await this.getTransactionReceipt(txHash);
        Logger.info("Detailed transaction info:");
        Logger.info(`Transaction Hash: ${tx.hash}`);
        Logger.info(`Gas Limit: ${tx.gasLimit.toString()}`);
        Logger.info(`Gas Used: ${receipt?.gasUsed.toString()}`);
        Logger.info(`Base Fee: ${receipt?.fee}`);
      }
      Logger.info(
        `Transaction ${txHash} queued for monitoring address: ${walletAddress}`
      );
      Logger.info(`Current Queue Size: ${this.transactionQueue.length}`);
    } else 
    {
      Logger.info(`TRANSACTION DOESNT MATCH....`);

    }
  }

  async getTransaction(
    txHash: string
  ): Promise<ethers.TransactionResponse | null> {
    try {
      return await this.httpProvider.getTransaction(txHash);
    } catch (error) {
      Logger.error(`Error retrieving transaction ${txHash}: ${error}`);
      throw error;
    }
  }

  async getBlockchainData(
    walletAddress: string
  ): Promise<{ block: ethers.Block | null; txCount: number; balance: bigint }> {
    // Get latest block
    const block = await this.httpProvider.getBlock("latest");
    Logger.info(`Latest block: ${block}`);
    console.log(block);

    // Get transaction count for an address
    const txCount = await this.httpProvider.getTransactionCount(walletAddress);
    Logger.info(
      `Number of transactions for address ${walletAddress}: ${txCount}`
    );

    // Read balance
    const balance = await this.httpProvider.getBalance(walletAddress);
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
        return await this.httpProvider.getTransactionReceipt(txHash);
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

  async getTokenBalance(
    contractAddress: string,
    walletAddress: string
  ): Promise<string | null> {
    const tokenContract = new ethers.Contract(
      contractAddress,
      [
        "function balanceOf(address owner) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
      ],
      this.httpProvider
    );

    try {
      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      Logger.error(`Error fetching balance for ${contractAddress}: ${error}`);
      return null;
    }
  }

  async getTokenBalances(walletAddress: string) {
    const usdcAddress = TOKEN_TYPE.USDC.address;
    // const usdtAddress = TOKEN_TYPE.USDT.address;
    const usdcBalance = await this.getTokenBalance(usdcAddress, walletAddress);
    // const usdtBalance = await this.getTokenBalance(usdtAddress, walletAddress, 6);
    return {
      usdc: usdcBalance,
      usdt: null,
    };
  }

  /**
   * Sends Ether from one address to another.
   * @param {string} privateKey - The private key of the sender's wallet.
   * @param {string} toAddress - The recipient's address.
   * @param {string} amount - The amount of Ether to send, in ether (not wei).
   * @returns {Promise<ethers.TransactionResponse>} - The transaction response object.
   */
  async sendEther(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<ethers.TransactionResponse> {
    const wallet = new ethers.Wallet(privateKey, this.httpProvider);
    const tx = {
      to: toAddress,
      value: ethers.parseEther(amount),
      // gasPrice: ethers.utils.parseUnits('10', 'gwei'),
      // gasLimit: 21000,
    };

    try {
      const transactionResponse = await wallet.sendTransaction(tx);
      Logger.info(`Transaction sent! Hash: ${transactionResponse.hash}`);
      await transactionResponse.wait();
      return transactionResponse;
    } catch (error) {
      Logger.error(`Failed to send transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Sends tokens from one address to another using an ERC-20 smart contract.
   *
   * @param privateKey The private key of the sender's wallet.
   *                   Ensure this is kept secure and never hard-coded in production!
   * @param token The token type.
   * @param toAddress The recipient's address.
   * @param amount The amount of tokens to send, as a string,
   *               to account for tokens that require decimal precision.
   */
  async sendTokens(
    privateKey: string,
    toAddress: string,
    amount: string,
    token: keyof typeof TOKEN_TYPE
  ): Promise<void> {
    const wallet = new ethers.Wallet(privateKey, this.httpProvider);
    const tokenConfig = TOKEN_TYPE[token];
    const tokenContract = new ethers.Contract(
      tokenConfig.address,
      ["function transfer(address to, uint256 amount) returns (bool)"],
      wallet
    );

    const amountToSend = ethers.parseUnits(amount, tokenConfig.decimals);
    try {
      const transactionResponse = await tokenContract.transfer(
        toAddress,
        amountToSend
      );
      Logger.info(
        `Tokens transferred to ${toAddress} | Transaction Hash: ${transactionResponse.hash}`
      );
      await transactionResponse.wait();
    } catch (error) {
      Logger.error(`Failed to send tokens: ${error}`);
      throw error;
    }
  }

  async parseUnits(amount: string, decimals: number): Promise<bigint> {
    try {
      const parsedAmount = ethers.parseUnits(amount, decimals);
      Logger.info(`Parsed Amount: ${parsedAmount.toString()}`);
      return parsedAmount;
    } catch (error) {
      Logger.error(`Error parsing amount: ${error}`);
      throw new Error("Failed to parse amount");
    }
  }

  async verifyTransaction(txHash: string) {
    Logger.info(`Verifying transaction: ${txHash}`);
    try {
      const receipt = await this.httpProvider.getTransactionReceipt(txHash);
      if (receipt) {
        Logger.info(`Transaction Receipt: ${JSON.stringify(receipt)}`);
        if (receipt.status === 1) {
          Logger.info("Transaction was successful.");
        } else {
          Logger.error("Transaction failed.");
        }
      } else {
        Logger.error("Receipt not found. Transaction might be pending.");
      }
    } catch (error) {
      Logger.error(`Error fetching transaction receipt: ${error}`);
    }
  }
}
