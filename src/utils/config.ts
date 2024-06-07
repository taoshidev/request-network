import { ethers } from "ethers";
import Logger from "../utils/logger";
interface TokenConfig {
  address: string;
  abi: ethers.InterfaceAbi;
  decimals: number;
}

export const getConfig = () => {
  if (!process.env.INFURA_PROJECT_ID) {
    Logger.warn(
      "INFURA_PROJECT_ID is not set in the environment variables. Crypto payment will be disabled."
    );
  }

  return {
    network: process.env.NODE_ENV === "production" ? "mainnet" : "sepolia",
    infuraProjectId: process.env.INFURA_PROJECT_ID,
    isProduction: process.env.NODE_ENV === "production",
    addresses:
      process.env.NODE_ENV === "production"
        ? {
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0CE3606EB48",
            USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          }
        : {
            USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
            USDT: "0x3E3fE2b5cF8c087bE77Df9B7f5269cF2fcB6B157",
          },
  };
};

/**
 * Setup token configurations based on environment.
 */
export const setupTokenConfig = (): Record<string, TokenConfig> => {
  const { isProduction, addresses } = getConfig();
  return {
    USDC: {
      decimals: 6,
      address: addresses.USDC,
      abi: [
        "event Transfer(address indexed from, address indexed to, uint amount)",
        "function decimals() view returns (uint8)",
      ],
    },
    USDT: {
      decimals: 6,
      address: addresses.USDT,
      abi: [
        "event Transfer(address indexed from, address indexed to, uint amount)",
        "function decimals() view returns (uint8)",
      ],
    },
  };
};
