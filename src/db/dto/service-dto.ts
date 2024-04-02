import { BaseDTO } from "./base-dto.js";

export class ServiceDTO implements BaseDTO {
  id?: string;
  type?: "consumer" | "validator";
  name?: string;
  rnConsumerApiUrl?: string;
  rnConsumerRequestKey?: string;
  rnValidatorApiId?: string;
  rnValidatorHotkey?: string;
  rnValidatorMeta?: {
    subnetId: string;
    endpoint: string;
  };
  constructor(data: Partial<ServiceDTO>) {
    Object.assign(this, data);
  }
}
