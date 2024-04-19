import axios, { AxiosInstance } from "axios";
import Logger from "../utils/logger";

type UpholdTransaction = {
  id: string;
  status: string;
  type: string;
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
  async authenticate(): Promise<void> {
    try {
      const response = await axios.post(
        `${this.client.defaults.baseURL}/oauth2/token`,
        {
          client_id: process.env.UPHOLD_CLIENT_ID,
          client_secret: process.env.UPHOLD_CLIENT_SECRET,
          grant_type: "client_credentials",
        }
      );
      const accessToken = response.data.access_token;
      this.client.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${accessToken}`;
      Logger.info("Authenticated successfully with Uphold API.");
    } catch (error) {
      Logger.error(`Failed to authenticate with Uphold API: ${error}`);
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
   * @param {string} fromCurrency The currency code to convert from.
   * @param {string} toCurrency The currency code to convert to.
   * @param {string} amount The amount to convert.
   * @returns {Promise<UpholdTransaction>} A promise that resolves to the transaction details.
   */
  async convertCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: string
  ): Promise<UpholdTransaction> {
    try {
      const response = await this.client.post(
        `/v0/me/cards/${fromCurrency}/transactions`,
        {
          denomination: {
            amount: amount,
            currency: fromCurrency,
          },
          destination: toCurrency,
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
    currency: string,
    amount: string,
    address: string
  ): Promise<UpholdTransaction> {
    try {
      const response = await this.client.post(
        `/v0/me/cards/${currency}/transactions`,
        {
          denomination: {
            amount: amount,
            currency: currency,
          },
          destination: address,
        }
      );
      Logger.info(`Withdrawal successful: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      Logger.error(`Failed to withdraw to address: ${error}`);
      throw error;
    }
  }
}
