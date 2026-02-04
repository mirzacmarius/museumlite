import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CONVEX_SITE_URL: z.string().url(),
    LOOPS_FORM_ID: z.optional(z.string().min(1)),
    POLAR_ORGANIZATION_TOKEN: z.string().min(1),
    POLAR_WEBHOOK_SECRET: z.string().min(1),
    POLAR_INTEGRATIONS_WEBHOOK_SECRET: z.optional(z.string().min(1)),
    INTEGRATION_PRODUCT_LIBRARY: z.optional(z.string().min(1)),
    RESEND_API_KEY: z.optional(z.string().min(1)),
    RESEND_SENDER_EMAIL_AUTH: z.optional(z.string().email()),
    SITE_URL: z.string().url(),
  },
  runtimeEnv: {
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
    LOOPS_FORM_ID: process.env.LOOPS_FORM_ID,
    POLAR_ORGANIZATION_TOKEN: process.env.POLAR_ORGANIZATION_TOKEN,
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
    POLAR_INTEGRATIONS_WEBHOOK_SECRET:
      process.env.POLAR_INTEGRATIONS_WEBHOOK_SECRET,
    INTEGRATION_PRODUCT_LIBRARY: process.env.INTEGRATION_PRODUCT_LIBRARY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_SENDER_EMAIL_AUTH: process.env.RESEND_SENDER_EMAIL_AUTH,
    SITE_URL: process.env.SITE_URL,
  },
  skipValidation: !process.env.VALIDATE_ENV,
});
