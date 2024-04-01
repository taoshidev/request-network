import { BaseDTO } from "./base-dto.js";

export class KeyDTO implements BaseDTO {
  id?: string;
  serviceId?: string;
  key?: string;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  constructor(data: Partial<KeyDTO>) {
    Object.assign(this, data);
  }
}
