import { Request, Response } from "express";
import { enrollments } from "../db/schema";
import BaseController from "../core/base.controller";
import Logger from "../utils/logger";
import StripeManager from "../service/stripe.manager";
import { EnrollmentPaymentRequestDTO } from "../db/dto/enrollment-payment-request.dto";
import { EnrollmentPaymentDTO } from "../db/dto/enrollment-payment.dto";
import * as jwt from 'jsonwebtoken';
import ServiceManager from "../service/service.manager";
import { isEqual as _isEqual } from 'lodash';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Controller for handling payments.
 */
export default class PaymentCtrl extends BaseController {
  stripeService = new StripeManager();
  serviceService = new ServiceManager();

  constructor() {
    super(enrollments);
  }

  /**
   * @param {Request} req - Express.js request object containing the enrollment information in the body.
   * @param {Response} res - Express.js response object.
   * @param {NextFunction} next - Express.js next middleware function.
   * @returns A 201 status code and the enrollment id and enrollment email on success, or a 400 status code with an error message on failure.
   */
  handleConsumerPayment = async (req: Request, res: Response) => {
    const { body } = req as EnrollmentPaymentRequestDTO;

    if (!body?.rnToken)
      return res.status(400).json({ error: "Request missing payload" });


    try {
      const enrollment = await this.stripeService.enroll(body as EnrollmentPaymentDTO);
      return res
        .status(201)
        .json(enrollment);
    } catch (error: Error | unknown) {
      Logger.error("Error processing payment:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  };

  handleUnsubscribe = async (req: Request, res: Response) => {
    try {
      const { serviceId } = req.body;
      const unsubscribedService = await this.stripeService.cancelSubscription(serviceId);

      return res
        .status(201)
        .json(unsubscribedService);
    } catch (error) {
      Logger.error("Error cancelling subscription:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  }

  /**
  * @param {Request} req - Express.js request object containing webhook information in the body.
  * @param {Response} res - Express.js response object.
  * @param {NextFunction} next - Express.js next middleware function.
  * @returns A 201 status code and ok message on success, or a 400 status code with an error message on failure.
  */
  webhooks = async (req: Request, res: Response) => {
    try {
      const webhookRes = await this.stripeService.stripeWebhook(req, res);
      return res
        .status(201)
        .json(webhookRes);
    } catch (error: Error | unknown) {
      Logger.error("Error processing payment:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  };

  /**
 * Creates a token that will need to be sent back to create a stripe subscription.
 * @param {Request} req - Express.js request object containing the service id in the body.
 * @param {Response} res - Express.js response object.
 * @param {NextFunction} next - Express.js next middleware function.
 * @returns A 201 status code and the token on success, or a 400 status code with an error message on failure.
 */
  getPaymentToken = async (req: Request, res: Response) => {
    try {
      const { body } = req;
      const secret = process.env.STRIPE_ENROLLMENT_SECRET || '';
      const service = await this.serviceService.one(body.serviceId);

      if (service.data) {
        const token = jwt.sign({
          serviceId: service.data.id,
          name: service.data.name,
          url: body.url,
          email: body.email,
          price: service.data.price,
          redirect: body.redirect,
          subscriptionId: service.data.subscriptionId,
          endpointId: service.data.endpointId
        }, secret, { expiresIn: '10m' });

        return res
          .status(200)
          .json({ token });
      } else {
        throw Error('Error finding service.');
      }
    } catch (error: Error | unknown) {
      Logger.error("Error creating token:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ error: (error as Error)?.message || "Internal server error" });
    }
  }

  checkForStripe = async (req: Request, res: Response) => {
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

      return res
        .status(200)
        .json({
          isHttps,
          stripeKey: !!process.env.STRIPE_SECRET_KEY ? true : false,
          stripePublicKey: !!process.env.STRIPE_PUBLIC_KEY ? true : false,
          enrollmentSecret: !!process.env.STRIPE_ENROLLMENT_SECRET ? true : false,
          stripeWebhooksKey: !!process.env.STRIPE_WEBHOOKS_KEY ? true : false,
          newEndpointCreated,
          webhooks,
          webhookEvents,
          account: {
            requirements: {
              currently_due: account?.requirements?.currently_due || [],
              eventually_due: account?.requirements?.eventually_due || [],
              past_due: account?.requirements?.past_due || []
            },
            capabilities: account?.capabilities || {}
          }
        });
    } catch (error: Error | unknown) {
      console.log(error);
      Logger.error("Error creating token:" + JSON.stringify(error));
      return res
        .status(500)
        .json({ ok: false, error: (error as Error)?.message || "Internal server error" });
    }
  }
}
