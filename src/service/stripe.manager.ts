import DatabaseWrapper from "../core/database.wrapper";
import { Request, Response } from "express";
import Logger from "../utils/logger";
import ServiceManager from "./service.manager";
import { EnrollmentDTO } from "../db/dto/enrollment.dto";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { enrollments, services } from "../db/schema";
import { EnrollmentPaymentDTO } from "../db/dto/enrollment-payment.dto";
import { ServiceDTO } from "../db/dto/service.dto";
import { AuthenticatedRequest, XTaoshiHeaderKeyType } from "../core/auth-request";
import TransactionManager from "./transaction.manager";
import { isEqual as _isEqual } from 'lodash';

const STRIPE_WEBHOOK_IDENTIFIER = 'Request Network';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default class StripeManager extends DatabaseWrapper<EnrollmentDTO> {
  private serviceManager: ServiceManager = new ServiceManager();
  private transactionManager: TransactionManager = new TransactionManager();

  constructor() {
    super(enrollments);
  }

  enroll = async (transaction: EnrollmentPaymentDTO) => {
    let customer: any;

    try {
      if (!transaction) {
        Logger.error("Not Authorized: ");
        return { data: null, error: "Not Authorized" };
      } else {
        // get service user signed up for
        const serviceReq = await this.serviceManager.find(eq(services.subscriptionId, transaction.tokenData.subscriptionId));
        const service = serviceReq?.data?.[0];
        const stripeEnrollment: any = {
          metadata: {
            'App': STRIPE_WEBHOOK_IDENTIFIER,
            'User ID': service?.meta?.consumerId,
            Service: service?.name,
            'Service ID': transaction.tokenData?.serviceId,
            Email: transaction.email,
            'Endpoint Url': transaction.tokenData?.url
          }
        };

        if (transaction.token) {
          stripeEnrollment.source = transaction.token;
          stripeEnrollment.email = transaction.email;
        }

        let userEnrollment: Partial<EnrollmentDTO> = {
          serviceId: service?.id
        };

        // get or create stripe record for service
        if (transaction.tokenData?.serviceId) {
          const enrollmentRes = await this.find(eq(enrollments.serviceId, transaction.tokenData.serviceId));
          if (enrollmentRes.data?.[0]?.serviceId) {
            userEnrollment = enrollmentRes.data?.[0]
          }

          let customer;
          // get customer id with matching email if it exists.
          const customers = await stripe.customers.list({ email: transaction.email });
          if (customers?.data?.length > 0) customer = customers.data[0];

          if (customer && !customer.deleted) {
            customer = await stripe.customers.update(customer.id, stripeEnrollment);
            userEnrollment.stripeCustomerId = customer.id;
          } else {
            customer = await stripe.customers.create(stripeEnrollment);
            userEnrollment.stripeCustomerId = customer.id;
          }
        } else {
          customer = await stripe.customers.create(stripeEnrollment);
          userEnrollment.stripeCustomerId = customer.id;
        }

        if (service) {
          return await this.stripeProcess({ transaction, service, userEnrollment });
        }
        else throw Error('Service not found.')
      }
    } catch (error: any) {
      Logger.error("Enrollment error: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  stripeProcess = async (
    { transaction, service, userEnrollment }:
      { transaction: EnrollmentPaymentDTO, service: ServiceDTO, userEnrollment: Partial<EnrollmentDTO> }
  ) => {
    try {
      const stripePlanId = userEnrollment.stripePlanId;
      let plan;

      if (stripePlanId) {
        plan = await stripe.plans.retrieve(stripePlanId);
      }

      if (!plan) {
        plan = await stripe.plans.create({
          amount: service?.price ? +service?.price * 100 : undefined,
          interval: 'month',
          product: {
            name: service?.name
          },
          metadata: {
            'App': STRIPE_WEBHOOK_IDENTIFIER,
            'User ID': service?.meta?.consumerId,
            Service: service.name,
            'Service ID': transaction.tokenData?.serviceId,
            Email: transaction.email,
            'Endpoint Url': transaction.tokenData?.url
          },
          currency: 'usd'
        })
          .catch((error: any) => {
            Logger.error("Error stripe process: " + JSON.stringify(error));
            return { data: null, error: error.message || "Internal server error" };
          });

        userEnrollment.stripePlanId = plan.id;
      }

      const subscriptionId = userEnrollment.stripeSubscriptionId;
      let subscription: any;
      if (subscriptionId) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      }

      if (subscriptionId && !subscription.canceled_at) {
        const basePrice = service.price ? +service.price * 100 : 0;

        if (basePrice === 0) {
          stripe.subscriptions.cancel(subscription.id);
          userEnrollment.stripeSubscriptionId = null;
        } else {
          subscription = await stripe.subscriptions.update(
            subscription.id,
            {
              items: [{
                id: subscription.items.data[0].id,
                plan: plan.id,
                quantity: 1
              }],
              metadata: {
                'App': STRIPE_WEBHOOK_IDENTIFIER,
                'User ID': service?.meta?.consumerId,
                Service: service.name,
                'Service ID': transaction.tokenData?.serviceId,
                Email: transaction.email,
                'Endpoint Url': transaction.tokenData?.url
              }
            }
          );
        }
      } else {
        subscription = await stripe.subscriptions.create({
          customer: userEnrollment.stripeCustomerId,
          items: [{
            plan: plan.id,
            quantity: 1
          }],
          metadata: {
            'App': STRIPE_WEBHOOK_IDENTIFIER,
            'User ID': service?.meta?.consumerId,
            Service: service.name,
            'Service ID': transaction.tokenData?.serviceId,
            Email: transaction.email,
            'Endpoint Url': transaction.tokenData?.url
          }
        });
        userEnrollment.stripeSubscriptionId = subscription.id;
      }

      if (transaction.token) {
        userEnrollment.email = transaction.email;
        userEnrollment.expMonth = transaction.expMonth;
        userEnrollment.expYear = transaction.expYear;
        userEnrollment.lastFour = +transaction.lastFour;
      }

      userEnrollment.currentPeriodEnd = DateTime.fromSeconds(+subscription.current_period_end).toJSDate();
      userEnrollment.active = true;

      const enrollment = userEnrollment.id ? await this.update(userEnrollment.id, userEnrollment as EnrollmentDTO) : await this.create(userEnrollment as EnrollmentDTO);
      const data = (enrollment.data as EnrollmentDTO[])?.[0];

      const statusRes = await this.serviceManager.changeStatus(service?.id as string, true);

      await AuthenticatedRequest.send({
        method: "PUT",
        path: "/api/status",
        body: { subscriptionId: service.subscriptionId, active: true },
        xTaoshiKey: XTaoshiHeaderKeyType.Validator,
      });

      return {
        data: [{
          id: data.id,
          email: data.email,
          active: statusRes?.data?.active
        }], error: enrollment.error && 'Error processing payment.'
      }
    } catch (error: any) {
      Logger.error("Error stripe process: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async cancelSubscription(serviceId: string) {
    try {
      const enrollmentRes = await this.find(eq(enrollments.serviceId, serviceId));
      const enrollment = enrollmentRes?.data?.[0];

      if (!enrollment) throw new Error('Enrollment not found.');

      const subscription = await stripe.subscriptions.retrieve(enrollment.stripeSubscriptionId);

      // option to cancel at end of subscription period
      // const subscription = await stripe.subscriptions.update(
      //   enrollment.stripeSubscriptionId,
      //   {cancel_at_period_end: true}
      // );

      if (!subscription?.canceled_at) {
        await stripe.subscriptions.cancel(enrollment.stripeSubscriptionId);
      }
      const statusRes = await this.serviceManager.changeStatus(enrollment.serviceId as string, false);
      await this.update(enrollment.id as string, { active: false });

      await AuthenticatedRequest.send({
        method: "PUT",
        path: "/api/status",
        body: { subscriptionId: (statusRes.data as ServiceDTO[])?.[0]?.subscriptionId, active: false },
        xTaoshiKey: XTaoshiHeaderKeyType.Validator,
      });

      return statusRes;
    } catch (error: any) {
      Logger.error("Error stripe process: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  getStripeData(event: any) {
    let stripeSubscriptionId: string,
      currentPeriodEnd: Date | null = null;

    switch (event?.data?.object?.object) {
      case 'subscription':
        stripeSubscriptionId = event?.data?.object?.id;
        currentPeriodEnd = new Date(event?.data?.object?.current_period_end);
        break;
      case 'invoice':
        stripeSubscriptionId = event?.data?.object?.subscription;
        currentPeriodEnd = new Date(event?.data?.object?.lines?.data?.[0]?.period?.end);
        break;
      default:
        stripeSubscriptionId = event?.data?.object?.subscription;
        break;
    }

    return {
      stripeSubscriptionId,
      currentPeriodEnd
    };
  }

  stripeWebhook = async (req: Request, res: Response) => {
    try {
      const sig = req.headers?.['stripe-signature'],
        event = stripe.webhooks.constructEvent((req as any).rawBody, sig, process.env.STRIPE_WEBHOOKS_KEY);

      if (event) {
        if (event.type === 'payment_intent.succeeded' && event.data?.object?.metadata?.activate) {
          if (event.data?.object?.metadata?.activate) {
            await AuthenticatedRequest.send({
              method: "PUT",
              path: "/api/stripe-activate",
              body: { activate: true },
              xTaoshiKey: XTaoshiHeaderKeyType.Validator,
            });
          }
        }

        const app = event?.data?.object?.lines?.data?.[0]?.metadata?.App || event?.data?.object?.metadata?.App,
          serviceId = event?.data?.object?.lines?.data?.[0]?.metadata?.['Service ID'] || event?.data?.object?.metadata?.['Service ID'],
          { stripeSubscriptionId, currentPeriodEnd } = this.getStripeData(event);

        if (app === STRIPE_WEBHOOK_IDENTIFIER && stripeSubscriptionId) {
          const enrollmentRes = await this.find(eq(enrollments.stripeSubscriptionId, stripeSubscriptionId));
          const enrollmentId = enrollmentRes.data?.[0]?.id;

          if (enrollmentId && serviceId) {
            const serviceRes = await this.serviceManager.find(eq(services.id, serviceId));
            const subscriptionId = (serviceRes.data as ServiceDTO[])?.[0]?.subscriptionId;

            switch (event.type) {
              case event?.data.object.paid == true && 'invoice.payment_succeeded':
                await this.update(enrollmentId as string, { currentPeriodEnd: currentPeriodEnd, active: true });
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
                await this.update(enrollmentId as string, { currentPeriodEnd: currentPeriodEnd });
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
      Logger.error("Stripe webhook error: " + JSON.stringify(error));
      return { data: null, error: error.message || "Internal server error" };
    }
  }

  async checkForStripe(req?: Request, res?: Response) {
    const enabled_events = [
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.deleted',
      'customer.subscription.updated'
    ];
    try {
      const isHttps = (process.env.API_HOST || '').includes('https://');
      let webhooks = false,
        webhookEvents = false,
        newEndpointCreated = false,
        webhookEndpoint: any,
        account: any;
      if
        (process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PUBLIC_KEY &&
        process.env.STRIPE_ENROLLMENT_SECRET
      ) {
        account = await stripe.account.retrieve();
        const endpoints = await stripe.webhookEndpoints.list();
        webhookEndpoint = endpoints?.data?.find((endpoint: any) => endpoint.url === `${process.env.API_HOST}/webhooks`);

        if (isHttps && !webhookEndpoint && !process.env.STRIPE_WEBHOOKS_KEY) {
          webhookEndpoint = (await stripe.webhookEndpoints.create({
            enabled_events,
            url: `${process.env.API_HOST}/webhooks`,
          }));

          if (webhookEndpoint) newEndpointCreated = true;
        }

        if (!!webhookEndpoint) webhooks = true;
        if (_isEqual(webhookEndpoint?.enabled_events, enabled_events)) webhookEvents = true;
      }
      const stripeKey = !!process.env.STRIPE_SECRET_KEY ? true : false;
      const stripePublicKey = !!process.env.STRIPE_PUBLIC_KEY ? true : false;

      const stripeLiveMode = (stripeKey && !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) &&
        (stripePublicKey && !process.env.STRIPE_PUBLIC_KEY?.startsWith('pk_test_'));

      const stripeResponse = {
        isHttps,
        stripeKey,
        stripePublicKey,
        enrollmentSecret: !!process.env.STRIPE_ENROLLMENT_SECRET ? true : false,
        stripeWebhooksKey: !!process.env.STRIPE_WEBHOOKS_KEY ? true : false,
        newEndpointCreated,
        webhooks,
        webhookEvents,
        rnUrl: process.env.REQUEST_NETWORK_UI_URL,
        stripeLiveMode
      }
      if (res) {
        return res
          .status(200)
          .json(stripeResponse);
      }

      return stripeResponse;
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
}