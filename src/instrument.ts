import * as  Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: ['production', 'staging'].includes(process.env.NODE_ENV as string),
    integrations: [nodeProfilingIntegration()],
  
    // Add Performance Monitoring by setting tracesSampleRate
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  
    // Set sampling rate for profiling
    // This is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}

