import { BaseDTO } from "./base.dto.js";

export class StripeEnrollmentDTO extends BaseDTO {
  stripeCustomerId!: string;
  stripeSubscriptionId!: string | null;
  stripePlanId!: string | null;
  email!: string;
  lastFour!: number;
  expMonth!: number;
  expYear!: number;
  firstPayment!: Date;
  paid!: boolean;
  serviceId!: string;
  currentPeriodEnd?: Date | null;

  constructor(data: Partial<StripeEnrollmentDTO>) {
    super(data)
    Object.assign(this, data);
  }
}