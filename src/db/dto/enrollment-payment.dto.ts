import { PAYMENT_TYPE } from "../enum/payment-type";
import { ServiceDTO } from "./service.dto";

export interface TokenData {
  serviceId: string;
  name: string;
  url: string;
  email: string;
  subscriptionId: string;
  endpointId: string;
  paymentType: PAYMENT_TYPE;
  price: number;
  quantity?: number;
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
  service?: ServiceDTO
}