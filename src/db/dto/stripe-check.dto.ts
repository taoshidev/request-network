export class StripeCheckDTO {

  isHttps!: boolean;
  stripeKey!: boolean;
  stripePublicKey!: boolean;
  enrollmentSecret!: boolean;
  stripeWebhooksKey!: boolean;
  newEndpointCreated!: boolean;
  webhooks!: boolean;
  webhookEvents!: boolean;
  rnUrl!: string;
  stripeLiveMode!: boolean;

  constructor(data: Partial<StripeCheckDTO>) {
    Object.assign(this, data);
  }
}
