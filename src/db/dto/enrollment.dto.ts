import { BaseDTO } from "./base.dto.js";

export class EnrollmentDTO extends BaseDTO {
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

  constructor(data: Partial<EnrollmentDTO>) {
    super(data)
    Object.assign(this, data);
  }
}