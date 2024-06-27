import { isEqual as _isEqual } from 'lodash';
import { Request, Response } from "express";
import Logger from "../utils/logger";
import TransactionManager from './transaction.manager';
import { randomBytes } from "crypto";
import ServiceManager from './service.manager';
import { AuthenticatedRequest, XTaoshiHeaderKeyType } from 'src/core/auth-request';
import DatabaseWrapper from 'src/core/database.wrapper';
import { EnrollmentDTO } from 'src/db/dto/enrollment.dto';
import { paypal_enrollments, services } from 'src/db/schema';
import { eq } from 'drizzle-orm';
import { ServiceDTO } from 'src/db/dto/service.dto';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 8888 } = process.env;
const PAYPAL_BASE_URL = process.env.NODE_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export default class PayPalManager extends DatabaseWrapper<EnrollmentDTO> {
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
  async createOrder(enrollment: any) {
    const accessToken = await this.generateAccessToken();
    const url = `${PAYPAL_BASE_URL}/v2/checkout/orders`;

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

    const response = await fetch(url, {
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
    const dbEnrollment = enrollmentRes?.data?.[0] || {} as Partial<EnrollmentDTO>;

    // Object.assign(dbEnrollment, {
    //   email: jsonResponse?.payer?.email_address,
    //   serviceId: transaction?.serviceId,
    //   paid: true,
    //   active: true
    // });

    // const enrollment = dbEnrollment.id ? await this.update(dbEnrollment.id, dbEnrollment as EnrollmentDTO) : await this.create(dbEnrollment as EnrollmentDTO);

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

      console.log('verified request: ', JSON.stringify(req.body));

      if (event.event_type) {
        const dbServices: any = await this.serviceManager.find(eq(services.subscriptionId, event.custom_id as string)),
          dbService = dbServices?.[0],
          app = event?.data?.object?.lines?.data?.[0]?.metadata?.App || event?.data?.object?.metadata?.App,
          serviceId = dbService.id;

        if (event.id) {
          const enrollmentRes = await this.find(eq(paypal_enrollments.payPalSubscriptionId, event.id));
          const enrollmentId = enrollmentRes.data?.[0]?.id;

          if (enrollmentId && serviceId) {
            const serviceRes = await this.serviceManager.find(eq(services.id, serviceId));
            const subscriptionId = (serviceRes.data as ServiceDTO[])?.[0]?.subscriptionId;

            switch (event.type) {
              case event?.data.object.paid == true && 'CHECKOUT.ORDER.APPROVED':
                await this.update(enrollmentId as string, { currentPeriodEnd: null, active: true });
                await this.serviceManager.update(serviceId as string, { active: true });

                const transaction = {
                  serviceId,
                  walletAddress: '',
                  transactionHash: event.data?.object?.id || "Unknown Invoice",
                  confirmed: true,
                  fromAddress: enrollmentRes?.data?.[0]?.stripeCustomerId,
                  toAddress: serviceRes?.data?.[0]?.subscriptionId,
                  amount: (event.data?.object?.amount_paid / 100).toString(),
                  transactionType: "deposit" as "deposit" | "withdrawal",
                  blockNumber: -1,
                  meta: JSON.stringify(
                    {
                      hosted_invoice_url: event.data?.object?.hosted_invoice_url,
                      invoice_pdf: event.data?.object?.invoice_pdf
                    }
                  ),
                };
                await this.transactionManager.create(transaction);

                (transaction as any).meta = {
                  hosted_invoice_url: event.data?.object?.hosted_invoice_url,
                  invoice_pdf: event.data?.object?.invoice_pdf
                }

                await AuthenticatedRequest.send({
                  method: "PUT",
                  path: "/api/status",
                  body: { subscriptionId: subscriptionId, active: true, type: event.type, transaction },
                  xTaoshiKey: XTaoshiHeaderKeyType.Validator,
                });

                break;
              case 'invoice.payment_failed':
              case 'customer.subscription.deleted':
                await this.update(enrollmentId as string, { currentPeriodEnd: null, active: false })
                await this.serviceManager.update(serviceId as string, { active: false });
                await AuthenticatedRequest.send({
                  method: "PUT",
                  path: "/api/status",
                  body: { subscriptionId: subscriptionId, active: false, type: event.type },
                  xTaoshiKey: XTaoshiHeaderKeyType.Validator,
                });
                break;
              case 'customer.subscription.updated':
                // await this.update(enrollmentId as string, { currentPeriodEnd: currentPeriodEnd });
                break;
              default:
                break;
            }
          }
          return { data: 'ok' };
        } else return { data: 'ok' };
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
      let webhooks = false,
        webhookEvents = false,
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
        payPalWebhooksKey: !!process.env.PAYPAL_WEBHOOKS_KEY ? true : false,
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
      console.log(error);
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