import { BaseDTO } from "./base.dto";

export enum PAYMENT_SERVICE {
  STRIPE = 'stripe',
  PAYPAL = 'paypal'
}

export class ServiceDTO extends BaseDTO {
  type?: "consumer" | "validator";
  name?: string;
  consumerKeyId?: string;
  consumerApiUrl?: string;
  validatorId?: string;
  endpointId?: string;
  subscriptionId?: string;
  consumerServiceId?: string;
  price?: string;
  consumerWalletAddress?: string;
  serviceStatusType?: string;
  outstandingBalance?: number | string;
  daysPassDue?: number;
  validatorWalletAddress?: string;
  currencyType?: string;
  hotkey?: string;
  payPalPlanId?: string;
  paymentService?: PAYMENT_SERVICE;
  enabled?: boolean;
  hash?: string | null;
  meta?: {
    consumerId?: string;
    subnetId: string;
    endpoint: string;
    validatorId: string;
    endpointId: string;
    shortId: string;
    subscriptionId: string;
  };
  constructor(data: Partial<ServiceDTO>) {
    super(data)
    Object.assign(this, data);
  }
}