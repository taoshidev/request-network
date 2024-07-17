import { isEqual as _isEqual } from 'lodash';
import { Request, Response } from "express";
import Logger from "../utils/logger";
import TransactionManager from './transaction.manager';
import { randomBytes } from "crypto";
import ServiceManager from './service.manager';
import { AuthenticatedRequest, XTaoshiHeaderKeyType } from '../core/auth-request';
import DatabaseWrapper from '../core/database.wrapper';
import { PayPalEnrollmentDTO } from '../db/dto/paypal-enrollment.dto';
import { paypalProducts, paypal_enrollments, services } from '../db/schema';
import { eq } from 'drizzle-orm';
import { PAYMENT_SERVICE, ServiceDTO } from '../db/dto/service.dto';
import PaypalProductManager from './paypal-product.manager';
import { PayPalProductDTO } from '../db/dto/paypal-product.dto';
import { captureException } from '@sentry/node';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const PAYPAL_BASE_URL = process.env.NODE_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export default class PayPalManager extends DatabaseWrapper<PayPalEnrollmentDTO> {
  private transactionManager: TransactionManager = new TransactionManager();
  private serviceManager: ServiceManager = new ServiceManager();
  private paypalProductManager: PaypalProductManager = new PaypalProductManager();

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
      captureException(error);
    }
  };


  /**
    * Create an order to start the transaction.
    * @see https://developer.paypal.com/docs/api/catalog-products/v1/
    */
  async createProductAndPlan(service: ServiceDTO) {
    try {
      const accessToken = await this.generateAccessToken();

      const productsRes = await this.paypalProductManager.find(eq(paypalProducts.endpointId, service.endpointId as string));
      let dbProduct = productsRes?.data?.[0];

      if (!dbProduct) {
        const productPayload = {
          name: service?.meta?.endpoint,
          description: `${process.env.VALIDATOR_NAME}-${service?.meta?.endpoint}`,
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
        const productSaveRes = await this.paypalProductManager.create({
          endpointId: service.endpointId,
          validatorId: service.validatorId,
          payPalProductId: productJson.id,
          name: productJson.name,
          description: productJson.description,
          meta: JSON.stringify(productJson),
        });
        dbProduct = (productSaveRes?.data as PayPalProductDTO[])?.[0];
      }

      if (dbProduct) {
        const planPayload = {
          product_id: dbProduct.payPalProductId,
          name: service.name,
          description: `${service.name}-${service.consumerApiUrl}`,
          status: "ACTIVE",
          billing_cycles: [
            {
              frequency: { interval_unit: "MONTH", interval_count: 1 },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 12,
              pricing_scheme: { fixed_price: { value: service?.price, currency_code: "USD" } },
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

        return {
          data: planJson,
          error: null,
        };
      }

      Logger.error("PayPal error creating product.");
      return { data: null, error: "Internal server error" };
    } catch (error: any) {
      Logger.error("PayPal error creating plan.");
      return { data: null, error: "Internal server error" };
    }
  };

  /**
   * Return service with plan id for initiating subscription.
   */
  async createSubscription(enrollment: any) {
    try {
      const data = enrollment.service;

      return { data, error: null };
    } catch (e) {
      return { data: null, e }
    }
  };

  async activate(enrollment: any) {
    const { serviceId, subscriptionId, price } = enrollment.tokenData;
    const statusRes: any = await this.serviceManager.update(serviceId as string, { paymentService: PAYMENT_SERVICE.PAYPAL, active: true, hash: null })
    delete statusRes?.data?.[0]?.hash;

    const payPalEnrollment = await this.create({
      serviceId: enrollment.tokenData.serviceId,
      payPalSubscriptionId: enrollment.subscriptionID,
      email: enrollment.tokenData.email,
      firstPayment: new Date(),
      active: true,
      paid: true
    });

    await AuthenticatedRequest.send({
      method: "PUT",
      path: "/api/status",
      body: { subscriptionId, active: true, transaction: { amount: +price }, type: 'invoice.payment_succeeded' },
      xTaoshiKey: XTaoshiHeaderKeyType.Validator,
    });

    return statusRes;
  }

  async cancelSubscription(serviceId: string) {
    try {
      const accessToken = await this.generateAccessToken();
      const enrollmentRes = await this.find(eq(paypal_enrollments.serviceId, serviceId));
      const enrollment = enrollmentRes?.data?.[0];

      if (!enrollment) throw new Error('Enrollment not found.');

      const existingSubResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${enrollment.payPalSubscriptionId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const existingSub = await existingSubResponse.json();

      if (existingSub.status !== 'CANCELLED') {
        const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${enrollment.payPalSubscriptionId}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ "reason": "User cancelled subscription" })
        });
        if (response.status !== 204) throw new Error('Unsubscribe failed.');
      }

      const statusRes: any = await this.serviceManager.changeStatus(enrollment.serviceId as string, false);
      await this.update(enrollment.id as string, { active: false });
      delete statusRes?.data?.[0]?.hash;

      await AuthenticatedRequest.send({
        method: "PUT",
        path: "/api/status",
        body: { subscriptionId: (statusRes.data as ServiceDTO[])?.[0]?.subscriptionId, active: false },
        xTaoshiKey: XTaoshiHeaderKeyType.Validator,
      });

      return statusRes;
    } catch (error: any) {
      Logger.error("Error paypal cancel subscription: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
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
  async captureOrder(orderID: string, quantity: number) {
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
    const service: any = await this.serviceManager.update(transaction?.serviceId as string, { paymentService: PAYMENT_SERVICE.PAYPAL, active: true, hash: null })
    delete service?.data?.[0]?.hash;

    await AuthenticatedRequest.send({
      method: "PUT",
      path: "/api/status",
      body: { subscriptionId: service?.data?.[0]?.subscriptionId, transaction, quantity, active: true, type: "CHARGE.SUCCEEDED" },
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

      const payPalEnrollmentReq = await this.find(eq(paypal_enrollments.payPalSubscriptionId, event?.resource?.id));
      const enrollment: PayPalEnrollmentDTO = payPalEnrollmentReq?.data?.[0] as PayPalEnrollmentDTO;

      if (event.event_type) {
        switch (event.event_type) {
          case "BILLING.SUBSCRIPTION.ACTIVATED":
            await this.update(enrollment.id as string, {
              payPalCustomerId: event?.resource?.subscriber?.payer_id,
              email: event?.resource?.subscriber?.email_address,
              firstPayment: new Date(),
              paid: true
            });

            const serviceReq: any = await this.serviceManager.update(enrollment.serviceId as string, { active: true });
            const activatedService = serviceReq?.data?.[0] as ServiceDTO;
            delete activatedService?.hash;

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
              body: { subscriptionId: activatedService.subscriptionId, type: event.event_type, transaction },
              xTaoshiKey: XTaoshiHeaderKeyType.Validator,
            });

            break;
          case "BILLING.SUBSCRIPTION.EXPIRED":
          case "BILLING.SUBSCRIPTION.CANCELLED":
            await this.update(enrollment?.id as string, { active: false })
            const deactivatedServiceReq: any = await this.serviceManager.update(enrollment?.serviceId as string, { active: false });
            const deActivatedService = deactivatedServiceReq?.data?.[0] as ServiceDTO;
            delete deActivatedService?.hash;

            await AuthenticatedRequest.send({
              method: "PUT",
              path: "/api/status",
              body: { subscriptionId: deActivatedService?.subscriptionId, active: false, type: event.event_type },
              xTaoshiKey: XTaoshiHeaderKeyType.Validator,
            });
            break;
          default:
            break;
        }

        return { data: 'ok' };
      } else {
        Logger.error("PayPal webhook validation error: ");
        return { data: null, error: "PayPal webhook validation error: " };
      }
    } catch (error: any) {
      Logger.error("PayPal webhook error: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async checkForPaypal(req?: Request, res?: Response) {
    try {
      const isHttps = (process.env.API_HOST || '').includes('https://');
      let webhooks = true,
        webhookEvents = true,
        newEndpointCreated = false;

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