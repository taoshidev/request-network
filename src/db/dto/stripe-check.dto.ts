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
  account?: {
    requirements: {
      currently_due: any[];
      eventually_due: any[],
      past_due: any[]
    },
    capabilities: any;
  }

  constructor(data: Partial<StripeCheckDTO>) {
    Object.assign(this, data);
  }
}
