import { BaseDTO } from "./base.dto.js";

export class ServiceDTO implements BaseDTO {
  id?: string;
  type?: "consumer" | "validator";
  name?: string;
  consumerKeyId?: string;
  consumerApiUrl?: string;
  hotkey?: string;
  meta?: {
    subnetId: string;
    endpoint: string;
    validatorId: string;
    shortId: string;
    subscriptionId: string;
  };
  constructor(data: Partial<ServiceDTO>) {
    Object.assign(this, data);
  }
}