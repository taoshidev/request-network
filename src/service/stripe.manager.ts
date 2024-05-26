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


const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default class StripeManager extends DatabaseWrapper<EnrollmentDTO> {
  private serviceManager: ServiceManager = new ServiceManager();

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
            'App': 'Request Network',
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
        if (transaction.tokenData.serviceId) {
          // get customer id with matching email if it exists.
          const enrollmentForEmail = await this.find(eq(enrollments.email, transaction.email));
          const stripeCustomerId = enrollmentForEmail?.data?.[0]?.stripeCustomerId;

          // matches service to be updated
          if (transaction.tokenData.serviceId === enrollmentForEmail?.data?.[0]?.serviceId) {
            userEnrollment = enrollmentForEmail?.data?.[0];
            // is another service
          } else {
            const enrollmentRes = await this.find(eq(enrollments.serviceId, transaction.tokenData.serviceId));
            if (enrollmentRes.data?.[0]?.serviceId) {
              userEnrollment = enrollmentRes.data?.[0]
            }
          }
          let customer;
          if (stripeCustomerId) {
            customer = await stripe.customers.retrieve(stripeCustomerId);
          }

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
            'App': 'Request Network',
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
                'App': 'Request Network',
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
            'App': 'Request Network',
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
        const app = event?.data?.object?.lines?.data?.[0]?.metadata?.App || event?.data?.object?.metadata?.App,
          { stripeSubscriptionId, currentPeriodEnd } = this.getStripeData(event);

        if (app === 'Request Network') {
          const enrollmentRes = await this.find(eq(enrollments.stripeSubscriptionId, stripeSubscriptionId));
          const statusRes = await this.serviceManager.find(eq(services.id, enrollmentRes?.data?.[0]));

          if (enrollmentRes.data?.[0]?.id) {
            switch (event.type) {
              case event?.data.object.paid == true && 'invoice.payment_succeeded':
                await this.update(enrollmentRes.data[0].id as string, { currentPeriodEnd: currentPeriodEnd, active: true });
                await this.serviceManager.update(enrollmentRes.data[0].id as string, { active: true });

                await AuthenticatedRequest.send({
                  method: "PUT",
                  path: "/api/status",
                  body: { subscriptionId: (statusRes.data as ServiceDTO[])?.[0]?.subscriptionId, active: true },
                  xTaoshiKey: XTaoshiHeaderKeyType.Validator,
                });

                break;
              case 'invoice.payment_failed':
                await this.update(enrollmentRes.data[0].id as string, { currentPeriodEnd: null, active: false })
                await this.serviceManager.update(enrollmentRes.data[0].id as string, { active: false });

                stripe.set('current_period_end', null);

                await AuthenticatedRequest.send({
                  method: "PUT",
                  path: "/api/status",
                  body: { subscriptionId: (statusRes.data as ServiceDTO[])?.[0]?.subscriptionId, active: false },
                  xTaoshiKey: XTaoshiHeaderKeyType.Validator,
                });
                await stripe.save();
                break;
              case 'customer.subscription.updated':
                await this.update(enrollmentRes.data[0].id as string, { currentPeriodEnd: currentPeriodEnd })
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
}