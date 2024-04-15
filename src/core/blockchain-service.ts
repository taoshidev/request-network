import { ethers } from "ethers";

/**
 * BlockchainService class provides methods to interact with blockchain technologies.
 * It includes creating and managing wallets which can be used for creating escrow accounts and managing payment activities.
 */
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
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
   * const blockchainService = new BlockchainService();
   * blockchainService.monitorTransactions('0x1234567890123456789012345678901234567890');
   * ```
   *
   * @note
   * - Ensure that the Infura project ID is properly configured.
   * - TODO: Test and setup cron tasks to run. Additional logic needed
   * - TODO: Monitor for pending transactions. Send data to UI application
   */
  async monitorTransactions(address: string): Promise<void> {
    this.provider.on("pending", async (txHash) => {
      const tx = await this.provider.getTransaction(txHash);
      if (tx && (tx.to === address || tx.from === address)) {
        console.log(
          `Transaction detected - Hash: ${tx.hash}, From: ${tx.from}, To: ${
            tx.to
          }, Value: ${ethers.formatEther(tx.value)}`
        );
      }
    });
  }
}
