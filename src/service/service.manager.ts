import { ServiceDTO } from "../db/dto/service.dto";
import { services, wallets } from "../db/schema";
import { BaseController } from "../core/base.controller";
import Logger from "../utils/logger";
import DatabaseWrapper from "../core/database.wrapper";
import { DrizzleResult } from "../core/database.wrapper";
import { eq, and, isNotNull } from "drizzle-orm";
import { ServiceWithWalletDTO } from "../db/dto/service-wallet.dto";

export default class ServiceManager extends DatabaseWrapper<ServiceDTO> {
  public wallet: BaseController;
  constructor() {
    super(services);
    this.wallet = new BaseController(wallets);
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

  async getActiveSubscriptions(): Promise<
    DrizzleResult<ServiceWithWalletDTO[]>
  > {
    try {
      const data = await this.db
        .select({
          id: services.id,
          active: services.active,
          price: services.price,
          hotkey: services.hotkey,
          publicKey: wallets.publicKey,
          privateKey: wallets.privateKey,
        })
        .from(services)
        .leftJoin(wallets, eq(services.id, wallets.serviceId))
        .where(
          and(
            eq(services.active, true),
            isNotNull(wallets.publicKey),
            isNotNull(wallets.privateKey)
          )
        );
      return { data: data as ServiceWithWalletDTO[], error: null };
    } catch (error: any) {
      Logger.error("Error get active services: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }
}
