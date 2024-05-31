import { Request } from "express";
import { EnrollmentPaymentDTO } from "./enrollment-payment.dto";

export interface EnrollmentPaymentRequestDTO extends Request {
  body: Partial<EnrollmentPaymentDTO>;
}
