import DatabaseWrapper from "../core/database.wrapper";
import { Request, Response } from "express";
import Logger from "../utils/logger";
import ServiceManager from "./service.manager";
import { EnrollmentDTO } from "src/db/dto/enrollment.dto";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { enrollments, services } from "../db/schema";
import { EnrollmentPaymentDTO } from "src/db/dto/enrollment-payment.dto";
import { ServiceDTO } from "src/db/dto/service.dto";


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
        const service = await this.serviceManager.one(transaction.serviceId);
        const stripeEnrollment: any = {
          metadata: {
            'App': 'Request Network',
            'User ID': (service?.data as ServiceDTO[])?.[0]?.meta?.consumerId,
            Service: (service?.data as ServiceDTO[])?.[0]?.name,
            Email: transaction.email
          }
        };

        if (transaction.token) {
          stripeEnrollment.source = transaction.token;
          stripeEnrollment.email = transaction.email;
        }

        let userEnrollment: Partial<EnrollmentDTO> = {
          serviceId: (service?.data as ServiceDTO[])?.[0]?.id
        };

        // get or create stripe record for service
        if (transaction.serviceId) {
          const enrollmentForEmail = await this.find(eq(enrollments.email, transaction.email));
          const stripeCustomerId = enrollmentForEmail?.data?.[0]?.stripeCustomerId;

          if (transaction.serviceId === enrollmentForEmail?.data?.[0]?.serviceId) {
            userEnrollment = enrollmentForEmail?.data?.[0];
          } else {
            const enrollmentRes = await this.find(eq(enrollments.serviceId, transaction.serviceId));
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
          } else {
            customer = await stripe.customers.create(stripeEnrollment);
            userEnrollment.stripeCustomerId = customer.id;
          }
        } else {
          customer = await stripe.customers.create(stripeEnrollment);
          userEnrollment.stripeCustomerId = customer.id;
        }

        if (service?.data) {
          return await this.stripeProcess({ transaction, service: (service.data as ServiceDTO[])?.[0] as ServiceDTO, userEnrollment });
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
          amount: service?.price,
          interval: 'month',
          product: {
            name: service?.name
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
        const basePrice = +(service.price || 0);

        subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (basePrice === 0) {
          stripe.subscriptions.del(subscription.id);
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
                Service: service.name,
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
            Service: service.name,
          }
        });
        userEnrollment.stripeSubscriptionId = subscription.id;
      }

      if (transaction.token) {
        userEnrollment.email = transaction.email;
        userEnrollment.expMonth = transaction.expMonth;
        userEnrollment.expYear = transaction.expYear;
      }

      userEnrollment.currentPeriodEnd = DateTime.fromSeconds(+subscription.current_period_end).toJSDate();
      const enrollment = userEnrollment.id ? await this.update(userEnrollment.id, userEnrollment as EnrollmentDTO) : await this.create(userEnrollment as EnrollmentDTO);
      const data = (enrollment.data as EnrollmentDTO[])?.[0];
      return {
        data: [{
          id: data.id,
          email: data.email
        }], error: enrollment.error && 'Error processing payment.'
      }
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
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOKS_KEY);

      if (event) {
        const app = event?.data?.object?.lines?.data?.[0]?.metadata?.App || event?.data?.object?.metadata?.App,
          { stripeSubscriptionId, currentPeriodEnd } = this.getStripeData(event);

        if (app === 'Request Network') {
          const stripeRes = await this.find(eq(enrollments.stripeSubscriptionId, stripeSubscriptionId));

          if (stripeRes.data?.[0]?.id) {
            switch (event.type) {
              case event?.data.object.paid == true && 'invoice.payment_succeeded':
                await this.update(stripeRes.data[0].id as string, { currentPeriodEnd: currentPeriodEnd })
                break;
              case 'invoice.payment_failed':
                await this.update(stripeRes.data[0].id as string, { currentPeriodEnd: null })
                stripe.set('current_period_end', null);
                await stripe.save();
                break;
              case 'customer.subscription.updated':
                await this.update(stripeRes.data[0].id as string, { currentPeriodEnd: currentPeriodEnd })
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