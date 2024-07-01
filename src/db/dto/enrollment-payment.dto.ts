import { PAYMENT_TYPE } from "../enum/payment-type";

export interface TokenData {
  serviceId: string;
  name: string;
  url: string;
  email: string;
  subscriptionId: string;
  endpointId: string;
  paymentType: PAYMENT_TYPE;
  price: number;
}

export interface EnrollmentPaymentDTO {
  rnToken: string;
  tokenData: TokenData;
  email: string;
  name: string;
  token: string;
  lastFour: string;
  expMonth: number;
  expYear: number;
}