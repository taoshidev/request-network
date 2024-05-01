import axios, { AxiosInstance } from "axios";
import Logger from "../utils/logger";
import BlockchainManager from "./blockchain.manager";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";

type UpholdTransaction = {
  id: string;
  status: string;
  type: string;
  destination: {
    address: string;
    amount: string;
    CardId: string;
    commission: string;
    currency: string;
    fee: string;
  };
};

type UpholdCard = {
  id: string;
  label: string;
  currency: string;
  balance: string;
  address: {
    wire: string;
    bitcoin: string;
    ethereum: string;
  };
};

/**
 * Provides methods to interact with the Uphold API, including authentication,
 * currency conversion, and funds withdrawal to specific validator wallet addresses.
 */
export default class UpholdConnector {
  private client: AxiosInstance;
  private blockchain: BlockchainManager;
  /**
   * Initializes a new instance of the UpholdConnector class with default
   * configuration for the Axios client.
   */
  constructor() {
    this.blockchain = new BlockchainManager();
    this.client = axios.create({
      baseURL:
        process.env.NODE_ENV !== "production"
          ? "https://api-sandbox.uphold.com"
          : "https://api.uphold.com",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Authenticates the client with the Uphold API using the client credentials
   * grant type. Stores and sets the obtained access token for subsequent requests.
   */
  async authenticate(): Promise<UpholdConnector> {
    try {
      const response = await axios.post(
        `${this.client.defaults.baseURL}/oauth2/token`,
        {
          client_id: process.env.UPHOLD_CLIENT_ID,
          client_secret: process.env.UPHOLD_CLIENT_SECRET,
          grant_type: "client_credentials",
        },
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      const accessToken = response.data.access_token;
      this.client.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${accessToken}`;
      Logger.info("Authenticated successfully with Uphold API...");
    } catch (error) {
      Logger.error(`Failed to authenticate with Uphold API: ${error}`);
      throw error;
    }
    return this;
  }

  async getCards() {
    const response = await this.client.get("/v0/me/cards");
    return response.data;
  }

  async getCardByCurrency(currency: string): Promise<UpholdCard | null> {
    try {
      const cards = await this.getCards();
      const card = cards.find((card: UpholdCard) => card.currency === currency);
      if (card) {
        Logger.info(`Card found for currency ${currency}: ${card.id}`);
        return card;
      } else {
        Logger.info(
          `No card found for currency ${currency}, considering creating one.`
        );
        return null;
      }
    } catch (error) {
      Logger.error(`Failed to get card by currency: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches and returns the list of all available currencies supported by Uphold.
   * @returns {Promise<string[]>} A promise that resolves to an array of currency codes.
   */
  async getAvailableCurrencies(): Promise<string[]> {
    try {
      const response = await this.client.get("/v0/ticker");
      const currencies = new Set<string>();
      response.data.forEach((item: any) => {
        const currency = item.pair.substring(0, 3);
        currencies.add(currency);
      });
      return Array.from(currencies);
    } catch (error) {
      Logger.error(`Failed to fetch available currencies: ${error}`);
      throw error;
    }
  }

  async authCheck(): Promise<UpholdConnector> {
    if (!this.client.defaults.headers.common["Authorization"]) {
      Logger.error("Not authenticated to Uphold. Authenticating...");
      await this.authenticate();
    }
    return this;
  }

  /**
   * Converts a specified amount from one currency to another.
   * @param {string} cardId the card ID to use.
   * @param {string} denomination The currency code to convert and the amount.
   * @returns {Promise<UpholdTransaction>} A promise that resolves to the transaction details.
   */
  async convertCurrency(
    cardId: string,
    denomination: { amount: string; currency: string },
    destination: string
  ): Promise<UpholdTransaction> {
    await this.authCheck();

    try {
      const response = await this.client.post(
        `/v0/me/cards/${cardId}/transactions?commit=true`,
        {
          denomination,
          destination,
        }
      );
      Logger.info(`Conversion successful: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      Logger.error(
        `Failed to convert currency From: ${denomination.currency} To: TAO Reason: ${error}`
      );
      if (error.response) {
        Logger.error(
          `API Error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      } else if (error.request) {
        Logger.error(`API No Response: ${error?.request}`);
      } else {
        Logger.error(`API Request Setup Error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Withdraws a specified amount of a currency to a given address.
   * @param {string} currency The currency code to withdraw.
   * @param {string} amount The amount to withdraw.
   * @param {string} address The destination address for the withdrawal.
   * @returns {Promise<UpholdTransaction>} A promise that resolves to the transaction details.
   */
  async withdrawToAddress(
    cardId: string,
    amount: string,
    destination: string
  ): Promise<UpholdTransaction> {
    try {
      const response = await this.client.post(
        `/v0/me/cards/${cardId}/transactions?commit=true`,
        {
          denomination: {
            amount,
            currency: "TAO",
          },
          destination,
        }
      );
      Logger.info(`Withdrawal successful: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      Logger.error(`Failed to withdraw to address: ${error}`);
      throw error;
    }
  }

  async checkCardExistsOrCreate(
    cards: UpholdCard[],
    currency: string
  ): Promise<void> {
    const cardExists = cards.some((card) => card.currency === currency);
    if (!cardExists) {
      await this.createCard(currency);
    }
  }

  private async createCard(currency: string): Promise<UpholdCard> {
    const response = await this.client.post("/v0/me/cards", {
      label: `${currency} Wallet`,
      currency,
    });
    Logger.info(`Created new ${currency} card: ${response.data.id}`);
    return response.data;
  }

  /**
   * Handles the transfer of funds from the service's wallet to an Uphold card, converts it to another currency,
   * and then sends it to a designated wallet.
   * @param {ServiceWithWalletDTO} service - The service with funds to transfer.
   */
  async handleFundsTransfer(
    service: ServiceWithWalletDTO
  ): Promise<UpholdTransaction | boolean> {
    await this.authCheck();
    const usdcCard = await this.getCardByCurrency("USDC");
    const taoCard = await this.getCardByCurrency("TAO");
    if (usdcCard && taoCard) {
      try {
        // Transfer USDC from the escrow wallet to the Uphold USDC card
        const transaction = await this.blockchain.sendTokens(
          service.privateKey as string,
          usdcCard.address.ethereum,
          service.price as string,
          "USDC"
        );
        if (!transaction.signature) return false;

        // Convert USDC to TAO on Uphold
        const conversion = await this.convertCurrency(
          usdcCard.id,
          { amount: service.price as string, currency: "USDC" },
          taoCard.id
        );
        if (!conversion) {
          throw new Error("Failed to convert USDC to TAO");
        }

        // Withdraw TAO from the Uphold TAO card to the designated wallet
        if (conversion.destination.amount) {
          const { destination } = conversion;
          const res = await this.withdrawToAddress(
            taoCard.id,
            destination.amount,
            service.hotkey as string
          );
          if (!res) {
            throw new Error("Failed to withdraw TAO from TAO card");
          }
          return res;
        }
      } catch (error) {
        Logger.error(
          `Failed to handle fund transfer for service ${service.id}: ${error}`
        );
        return false;
      }
    }
    return false;
  }

  /**
   * Checks the blockchain balance for a given subscription and deactivates it if the balance is zero
   * or not enough to cover the price. Also handles the conversion and transfer of funds if sufficient.
   * @param {ServiceWithWalletDTO} service - The subscription service to check.
   */
  async checkSubscriptionBalance(
    service: ServiceWithWalletDTO
  ): Promise<{ sufficient: boolean; balance: string } | void> {
    if (
      service.id &&
      service.publicKey &&
      service.privateKey &&
      service.price
    ) {
      const data = await this.blockchain.getTokenBalances(service.publicKey);
      const balance = data.usdc as string;
      const sufficient =
        balance && parseFloat(balance) >= parseFloat(service.price);

      if (!sufficient) {
        Logger.info(
          `Insufficient funds in wallet ${service.publicKey}. Setting active flag to false.`
        );
        return { sufficient: false, balance };
      }
      Logger.info(
        `Sufficient funds detected for wallet ${service.publicKey}: ${balance} USDC`
      );
      return { sufficient, balance };
    }
  }
}
