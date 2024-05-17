import { BaseDTO } from "./base.dto.js";

export class StripeDTO extends BaseDTO {
  stripe_subscription_id!: string;
  email!: string;
  lastFour!: number;
  expMonth!: number;
  expYear!: { type: Number };
  firstPayment!: { type: Date };
  paid!: boolean;
  serviceId!: string;
  currentPeriodEnd!: Date;

  constructor(data: Partial<StripeDTO>) {
    super(data)
    Object.assign(this, data);
  }
}