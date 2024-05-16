export interface ConsumerDTO {
  keyId: string;
  valid: boolean;
  name: string;
  ownerId: string;
  meta: {
    shortId: string;
    type: string;
    validatorId: string;
    subnetId: string;
    endpoint: string;
    subscriptionId: string;
    consumerServiceId: string;
    consumerApiUrl?: string;
  };
  enabled: boolean;
  permissions: Array<string>;
}
