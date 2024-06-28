import { BaseDTO } from "./base.dto.js";

export class PayPalEnrollmentDTO extends BaseDTO {
  payPalCustomerId!: string;
  payPalSubscriptionId?: string | null;
  payPalPlanId!: string | null;
  email?: string;
  paid!: boolean;
  serviceId!: string;
  firstPayment?: Date;

  constructor(data: Partial<PayPalEnrollmentDTO>) {
    super(data)
    Object.assign(this, data);
  }
}