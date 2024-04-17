import { BaseDTO } from "./base.dto.js";

export class WalletDTO implements BaseDTO {
  id?: string;
  serviceId?: string;
  publicKey?: string;
  privateKey?: string;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;

  constructor(data: Partial<WalletDTO>) {
    Object.assign(this, data);
  }
}
