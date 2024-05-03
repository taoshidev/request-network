import { BaseDTO } from "./base.dto.js";

export class ServiceDTO extends BaseDTO {
  type?: "consumer" | "validator";
  name?: string;
  consumerKeyId?: string;
  consumerApiUrl?: string;
  validatorId?: string;
  endpointId?: string;
  subscriptionId?: string;
  price?: string;
  hotkey?: string;
  meta?: {
    subnetId: string;
    endpoint: string;
    validatorId: string;
    shortId: string;
    subscriptionId: string;
  };
  constructor(data: Partial<ServiceDTO>) {
    super(data)
    Object.assign(this, data);
  }
}