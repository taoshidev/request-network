import { isEqual as _isEqual } from 'lodash';
import { Request, Response } from "express";
import Logger from "../utils/logger";
import TransactionManager from './transaction.manager';
import { randomBytes } from "crypto";
import ServiceManager from './service.manager';
import { AuthenticatedRequest, XTaoshiHeaderKeyType } from '../core/auth-request';
import DatabaseWrapper from '../core/database.wrapper';
import { PayPalEnrollmentDTO } from '../db/dto/paypal-enrollment.dto';
import { paypal_enrollments, services } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ServiceDTO } from '../db/dto/service.dto';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
const PAYPAL_BASE_URL = process.env.NODE_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export default class PayPalManager extends DatabaseWrapper<PayPalEnrollmentDTO> {
  private transactionManager: TransactionManager = new TransactionManager();
  private serviceManager: ServiceManager = new ServiceManager();

  constructor() {
    super(paypal_enrollments);
  }

  /**
   * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
   * @see https://developer.paypal.com/api/rest/authentication/
   */
  async generateAccessToken() {
    try {
      if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error("MISSING_API_CREDENTIALS");
      }
      const auth = Buffer.from(
        PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
      ).toString("base64");
      const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: "POST",
        body: "grant_type=client_credentials",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error("Failed to generate Access Token:", error);
    }
  };

  /**
   * Create an order to start the transaction.
   * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
   */
  async createSubscription(enrollment: any) {
    const accessToken = await this.generateAccessToken();

    const productPayload = {
      name: enrollment.tokenData?.name,
      description: enrollment.tokenData?.subscriptionId,
      type: "SERVICE",
      category: "SOFTWARE"
    };

    const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
        // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
        // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
      method: "POST",
      body: JSON.stringify(productPayload),
    });

    const productJson = await productResponse.json();

    const planPayload = {
      product_id: productJson.id,
      name: enrollment.tokenData.name,
      description: enrollment.tokenData.name,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 12,
          pricing_scheme: { fixed_price: { value: enrollment?.tokenData?.price?.toString(), currency_code: "USD" } },
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      }
    };

    const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
        // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
        // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
      method: "POST",
      body: JSON.stringify(planPayload),
    });

    const planJson = await planResponse.json();

    const userEnrollment: PayPalEnrollmentDTO = {
      active: true,
      serviceId: enrollment.tokenData?.serviceId,
      payPalCustomerId: '',
      payPalPlanId: planJson?.id,
      paid: false,
    };

    await this.create(userEnrollment as PayPalEnrollmentDTO);

    return {
      jsonResponse: planJson,
      httpStatusCode: planResponse.status,
    };
  };

  async activate(enrollment: any) {
    const { serviceId, subscriptionId, price } = enrollment.tokenData;
    const statusRes = await this.serviceManager.changeStatus(serviceId as string, true);

    await AuthenticatedRequest.send({
      method: "PUT",
      path: "/api/status",
      body: { subscriptionId, active: true, transaction: { amount: +price }, type: 'invoice.payment_succeeded' },
      xTaoshiKey: XTaoshiHeaderKeyType.Validator,
    });

    return statusRes;
  }

  /**
   * Create an order to start the transaction.
   * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
   */
  async createOrder(enrollment: any) {
    const accessToken = await this.generateAccessToken();

    const transaction = {
      serviceId: enrollment.tokenData?.serviceId,
      walletAddress: '',
      transactionHash: `Unknown Invoice ${randomBytes(32).toString("hex")}`,
      confirmed: false,
      fromAddress: enrollment.tokenData?.consumerServiceId,
      toAddress: enrollment.tokenData?.subscriptionId,
      amount: enrollment.tokenData?.price?.toString(),
      transactionType: "deposit" as "deposit" | "withdrawal",
      blockNumber: -1,
    };
    const newTransaction: any = await this.transactionManager.create(transaction);

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: enrollment.tokenData?.name,
          custom_id: enrollment.tokenData?.subscriptionId,
          invoice_id: newTransaction?.data?.[0]?.id,
          amount: {
            currency_code: "USD",
            value: enrollment.tokenData?.price,
          },
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING"
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
        // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
        // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
      method: "POST",
      body: JSON.stringify(payload),
    });

    return this.handleResponse(response);
  };

  /**
   * Capture payment for the created order to complete the transaction.
   * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
   */
  async captureOrder(orderID: string) {
    const accessToken = await this.generateAccessToken();
    const url = `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
        // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
        // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
    });

    const jsonResponse = await response.json();

    const transactionRes: any = await this.transactionManager.update(jsonResponse.purchase_units?.[0]?.payments?.captures?.[0]?.invoice_id, {
      meta: jsonResponse,
      transactionHash: orderID,
      confirmed: true
    });
    const transaction = transactionRes?.data?.[0];

    const enrollmentRes = await this.find(eq(paypal_enrollments.serviceId, transaction.serviceId as string));
    const dbEnrollment = enrollmentRes?.data?.[0] || {} as Partial<PayPalEnrollmentDTO>;

    // Object.assign(dbEnrollment, {
    //   email: jsonResponse?.payer?.email_address,
    //   serviceId: transaction?.serviceId,
    //   paid: true,
    //   active: true
    // });

    // const enrollment = dbEnrollment.id ? await this.update(dbEnrollment.id, dbEnrollment as PayPalEnrollmentDTO) : await this.create(dbEnrollment as PayPalEnrollmentDTO);

    const service: any = await this.serviceManager.changeStatus(transaction?.serviceId as string, true);

    await AuthenticatedRequest.send({
      method: "PUT",
      path: "/api/status",
      body: { subscriptionId: service?.data?.[0]?.subscriptionId, active: true },
      xTaoshiKey: XTaoshiHeaderKeyType.Validator,
    });

    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  };

  payPalWebhook = async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const accessToken = await this.generateAccessToken();
      let verifyBody = JSON.stringify({
        transmission_id: req.headers?.['paypal-transmission-id'],
        transmission_time: req.headers?.['paypal-transmission-time'],
        cert_url: req.headers?.['paypal-cert-url'],
        auth_algo: req.headers?.['paypal-auth-algo'],
        transmission_sig: req.headers?.['paypal-transmission-sig'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: ":webhookEvent:"
      });
      verifyBody = verifyBody.replace('\":webhookEvent:\"', (req as any).rawBody);

      const verify = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: verifyBody
      });
      const { verification_status } = await verify.json();

      if (verification_status !== 'SUCCESS') {
        Logger.error("PayPal webhook error: Verify failed");
        return { data: null, error: "Internal server error" };
      }

      if (event.event_type) {
        switch (event.event_type) {
          case "BILLING.SUBSCRIPTION.ACTIVATED":
            const payPalEnrollmentReq = await this.find(eq(paypal_enrollments.payPalPlanId, event?.resource?.plan_id));
            const enrollment: PayPalEnrollmentDTO = payPalEnrollmentReq?.data?.[0] as PayPalEnrollmentDTO;

            await this.update(enrollment.id as string, {
              payPalSubscriptionId: event?.resource?.id,
              payPalCustomerId: event?.resource?.subscriber?.payer_id,
              email: event?.resource?.subscriber?.email_address,
              firstPayment: new Date(),
              active: true,
              paid: true
            });

            const serviceReq: any = await this.serviceManager.update(enrollment.serviceId as string, { active: true });
            const activatedService = serviceReq?.data?.[0] as ServiceDTO;
            const transaction = {
              serviceId: enrollment?.serviceId,
              walletAddress: '',
              transactionHash: event?.id || `Unknown Invoice ${randomBytes(32).toString("hex")}`,
              confirmed: true,
              fromAddress: event?.resource?.subscriber?.payer_id,
              toAddress: activatedService?.subscriptionId,
              amount: (event.data?.object?.amount_paid / 100).toString(),
              transactionType: "deposit" as "deposit" | "withdrawal",
              blockNumber: -1,
            };
            await this.transactionManager.create(transaction);

            (transaction as any).meta = {
              hosted_invoice_url: event.data?.object?.hosted_invoice_url,
              invoice_pdf: event.data?.object?.invoice_pdf
            }

            await AuthenticatedRequest.send({
              method: "PUT",
              path: "/api/status",
              body: { subscriptionId: activatedService.subscriptionId, active: true, type: event.type, transaction },
              xTaoshiKey: XTaoshiHeaderKeyType.Validator,
            });

            break;
          default:
            break;
        }

        return { data: 'ok' };
      } else {
        Logger.error("Stripe webhook validation error: ");
        return { data: null, error: "Stripe webhook validation error: " };
      }
    } catch (error: any) {
      Logger.error("PayPal webhook error: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async checkForPaypal(req?: Request, res?: Response) {
    // const enabled_events = [
    //   'invoice.payment_succeeded',
    //   'invoice.payment_failed',
    //   'customer.subscription.deleted',
    //   'customer.subscription.updated'
    // ];
    try {
      const isHttps = (process.env.API_HOST || '').includes('https://');
      let webhooks = true,
        webhookEvents = true,
        newEndpointCreated = false,
        webhookEndpoint: any;

      if
        (process.env.STRIPE_SECRET_KEY &&
        process.env.PAYPAL_CLIENT_ID &&
        process.env.PAYMENT_ENROLLMENT_SECRET
      ) {
        // const endpoints = await stripe.webhookEndpoints.list();
        // webhookEndpoint = endpoints?.data?.find((endpoint: any) => endpoint.url === `${process.env.API_HOST}/webhooks`);

        // if (isHttps && !webhookEndpoint && !process.env.STRIPE_WEBHOOKS_KEY) {
        //   webhookEndpoint = (await stripe.webhookEndpoints.create({
        //     enabled_events,
        //     url: `${process.env.API_HOST}/webhooks`,
        //   }));

        //   if (webhookEndpoint) newEndpointCreated = true;
        // }

        // if (!!webhookEndpoint) webhooks = true;
        // if (_isEqual(webhookEndpoint?.enabled_events, enabled_events)) webhookEvents = true;
      }
      const payPalSecretKey = !!process.env.PAYPAL_CLIENT_SECRET ? true : false;
      const payPalClientId = !!process.env.PAYPAL_CLIENT_ID ? true : false;

      const payPalResponse = {
        isHttps,
        payPalSecretKey,
        payPalClientId,
        enrollmentSecret: !!process.env.PAYMENT_ENROLLMENT_SECRET ? true : false,
        payPalWebhookId: !!process.env.PAYPAL_WEBHOOK_ID ? true : false,
        newEndpointCreated,
        webhooks,
        webhookEvents,
        rnUrl: process.env.REQUEST_NETWORK_UI_URL,
      }

      if (res) {
        return res
          .status(200)
          .json(payPalResponse);
      }

      return payPalResponse;
    } catch (error: Error | unknown) {
      Logger.error("Error creating token:" + JSON.stringify(error));
      const errorResponse = { ok: false, error: (error as Error)?.message || "Internal server error" };
      if (res) {
        return res
          .status(500)
          .json(errorResponse);
      }

      return errorResponse;
    }
  }

  async handleResponse(response: any) {
    try {
      const jsonResponse = await response.json();

      return {
        jsonResponse,
        httpStatusCode: response.status,
      };
    } catch (err) {
      const errorMessage = await response.text();
      throw new Error(errorMessage);
    }
  }
}