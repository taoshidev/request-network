import axios, { AxiosInstance } from "axios";
import Logger from "../utils/logger";

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

  /**
   * Initializes a new instance of the UpholdConnector class with default
   * configuration for the Axios client.
   */
  constructor() {
    this.client = axios.create({
      baseURL:
        process.env.NODE_ENV === "development"
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
        // TODO: might need to create a card if it does not exist
        // return await this.createCard(currency);
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
    if (!this.client.defaults.headers.common["Authorization"]) {
      Logger.error("Authenticating to Uphold...");
      await this.authenticate();
    }
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
    } catch (error) {
      Logger.error(`Failed to convert currency: ${error}`);
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
}
