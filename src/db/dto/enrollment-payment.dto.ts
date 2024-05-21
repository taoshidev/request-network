export interface EnrollmentPaymentDTO {
  rnToken: string;
  tokenData: {
    serviceId: string;
    name: string;
    url: string;
    email: string;
    subscriptionId: string;
    endpointId: string;
  };
  email: string;
  token: string;
  LastFour: string;
  expMonth: number;
  expYear: number;
}