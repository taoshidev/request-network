import { ServiceDTO } from "../db/dto/service.dto";
import { services } from "../db/schema";
import BaseController from "../core/base.controller";
import Logger from "../utils/logger";
import DatabaseWrapper from "../core/database.wrapper";
import { DrizzleResult } from "../core/database.wrapper";
import { eq, ne, and, isNotNull } from "drizzle-orm";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";

export default class ServiceManager extends DatabaseWrapper<ServiceDTO> {
  constructor() {
    super(services);
  }

  /**
   * Pauses a subscription by setting its active status to false.
   * @param {string} id - The ID of the subscription to pause.
   * @returns {Promise<DrizzleResult<ServiceDTO>>} The result of the update operation.
   */
  async changeStatus(
    id: string,
    active: boolean
  ): Promise<DrizzleResult<ServiceDTO>> {
    try {
      const { data, error } = await this.update(id, {
        active,
      } as ServiceDTO);
      if (error) {
        throw new Error(error.message);
      }
      return { data, error: null };
    } catch (error: any) {
      Logger.error("Error updating service: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }
  async getSubscription(
    id: string
  ): Promise<DrizzleResult<ServiceWithWalletDTO>> {
    try {
      const data = await this.db
        .select({
          id: services.id,
          active: services.active,
          price: services.price,
          hotkey: services.hotkey,
          currencyType: services.currencyType,
          daysPassDue: services.daysPassDue,
          subscriptionId: services.subscriptionId,
          serviceStatusType: services.serviceStatusType,
          outstandingBalance: services.outstandingBalance,
          consumerWalletAddress: services.consumerWalletAddress,
          validatorWalletAddress: services.validatorWalletAddress,
        })
        .from(services)
        .where(eq(services.id, id));
      return { data: data?.[0] as ServiceWithWalletDTO, error: null };
    } catch (error: any) {
      Logger.error("Error get service by id: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async getSubscriberByAddress(
    address: string
  ): Promise<DrizzleResult<ServiceWithWalletDTO>> {
    try {
      const data = await this.db
        .select({
          id: services.id,
          active: services.active,
          createdAt: services.createdAt,
          price: services.price,
          hotkey: services.hotkey,
          currencyType: services.currencyType,
          daysPassDue: services.daysPassDue,
          subscriptionId: services.subscriptionId,
          serviceStatusType: services.serviceStatusType,
          outstandingBalance: services.outstandingBalance,
          consumerWalletAddress: services.consumerWalletAddress,
          validatorWalletAddress: services.validatorWalletAddress,
        })
        .from(services)
        .where(eq(services.consumerWalletAddress, address));
      return { data: data?.[0] as ServiceWithWalletDTO, error: null };
    } catch (error: any) {
      Logger.error("Error get service by id: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async getSubscriptions({
    active = true,
    inclusive = false,
    currencyType = "",
  } = {}): Promise<DrizzleResult<ServiceWithWalletDTO[]>> {
    try {
      const data = await this.db
        .select({
          id: services.id,
          active: services.active,
          price: services.price,
          hotkey: services.hotkey,
          currencyType: services.currencyType,
          daysPassDue: services.daysPassDue,
          subscriptionId: services.subscriptionId,
          serviceStatusType: services.serviceStatusType,
          outstandingBalance: services.outstandingBalance,
          createdAt: services.createdAt,
          consumerWalletAddress: services.consumerWalletAddress,
          validatorWalletAddress: services.validatorWalletAddress,
        })
        .from(services)
        .where(
          and(
            currencyType === "Crypto"
              ? ne(services.currencyType, "FIAT")
              : isNotNull(services.currencyType),
            inclusive ? isNotNull(services.active) : eq(services.active, active)
          )
        );
      return { data: data as ServiceWithWalletDTO[], error: null };
    } catch (error: any) {
      Logger.error("Error get active services: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async getDistinctValidators(): Promise<DrizzleResult<ServiceDTO[]>> {
    try {
      const data = await this.db
        .selectDistinct({
          validatorId: services.validatorId,
        })
        .from(services)
        .orderBy(services.validatorId);
      return { data: data as ServiceDTO[], error: null };
    } catch (error: any) {
      Logger.error("Error get distinct validators: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async getDistinctValidatorWallets(): Promise<DrizzleResult<ServiceDTO[]>> {
    try {
      const data = await this.db
        .selectDistinct({
          validatorWalletAddress: services.validatorWalletAddress,
        })
        .from(services)
        .where(ne(services.currencyType, "FIAT"))
        .orderBy(services.validatorWalletAddress);
      return { data: data as ServiceDTO[], error: null };
    } catch (error: any) {
      Logger.error(
        "Error get distinct validator wallets: " + JSON.stringify(error)
      );
      return { data: null, error: error.message || "Internal server error" };
    }
  }
}
