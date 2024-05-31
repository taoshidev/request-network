import { HDNodeWallet, ethers } from "ethers";
import Logger from "../utils/logger";
import { ContractTransactionResponse } from "ethers";
import { TOKENS } from "./transaction.manager";

/**
 * BlockchainManager class provides methods to interact with blockchain technologies.
 * It includes creating and managing wallets which can be used for creating escrow accounts and managing payment activities.
 */
export default class BlockchainManager {
  private httpProvider!: ethers.JsonRpcProvider;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const providerOptions = {
      polling: false,
      batchStallTime: 50,
      batchMaxSize: 1024 * 1024,
      batchMaxCount: 50,
      cacheTimeout: 300000,
    };

    const network =
      process.env.NODE_ENV !== "production" ? "sepolia" : "mainnet";
    const httpURL = `https://${network}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;

    this.httpProvider = new ethers.JsonRpcProvider(
      httpURL,
      network,
      providerOptions
    );
  }

  /**
   * Generates a new escrow wallet with a randomly created private key.
   * @returns {ethers.Wallet} A new wallet object representing the escrow wallet.
   */
  static createEscrowWallet(): ethers.Wallet | HDNodeWallet {
    return ethers.Wallet.createRandom();
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
      Logger.error(
        `Error fetching balance for wallet: ${walletAddress} contract: ${contractAddress}: ${error}`
      );
      return null;
    }
  }

  async getTokenBalances(walletAddress: string, type: string = "USDC") {
    const tokenAddress = TOKENS[type].address;
    const balance = await this.getTokenBalance(tokenAddress, walletAddress);
    return {
      balance,
      type,
      [type.toLowerCase()]: balance,
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
   * @param to The recipient's address.
   * @param amount The amount of tokens to send, as a string,
   *               to account for tokens that require decimal precision.
   */
  async sendTokens(
    privateKey: string,
    to: string,
    amount: string,
    token: keyof typeof TOKENS
  ): Promise<ContractTransactionResponse> {
    const wallet = new ethers.Wallet(privateKey, this.httpProvider);
    const tokenConfig = TOKENS[token];
    const tokenContract = new ethers.Contract(
      tokenConfig.address,
      ["function transfer(address to, uint256 amount) returns (bool)"],
      wallet
    );

    // Fetch the current nonce
    let nonce = await this.httpProvider.getTransactionCount(
      wallet.address,
      "latest"
    );

    const amt = ethers.parseUnits(amount, tokenConfig.decimals);

    try {
      const res = await tokenContract.transfer(to, amt, { nonce });
      Logger.info(
        `Transferring from Escrow to Uphold ${token} card ${to} | Transaction Hash: ${res.hash}`
      );
      await res.wait();
      Logger.info(
        `Tokens transferred from escrow to Uphold ${token} card ${to} | Transaction Hash: ${res.hash}`
      );
      return res;
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
          return true;
        }
        Logger.error("Transaction failed.");
        return false;
      }
      Logger.error("Receipt not found. Transaction might be pending.");
      return false;
    } catch (error) {
      Logger.error(`Error fetching transaction receipt: ${error}`);
    }
  }
}
