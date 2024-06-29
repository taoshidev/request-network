import { BaseDTO } from "./base.dto";

export class PayPalProductDTO extends BaseDTO {
  validatorId!: string;
  endpointId!: string;
  payPalProductId!: string;
  name!: string;
  description!: string;
  meta: any;

  constructor(data: Partial<PayPalProductDTO>) {
    super(data)
    Object.assign(this, data);
  }
}