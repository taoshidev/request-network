import { captureException } from "@sentry/node";

const SENTRY_ENABLED = !!process.env.SENTRY_DSN;

export const captureSentryError = (error: Error | unknown): void => {
  if (SENTRY_ENABLED) {
    captureException(error);
  }
};
