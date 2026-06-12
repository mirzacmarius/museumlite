import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

function readOptionalEnv(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}

export const env = createEnv({
  client: {
    NEXT_PUBLIC_CONVEX_URL: z.string().min(1),
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_CAL_LINK: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CONVEX_URL: readOptionalEnv(process.env.NEXT_PUBLIC_CONVEX_URL),
    NEXT_PUBLIC_OPENPANEL_CLIENT_ID: readOptionalEnv(
      process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
    ),
    NEXT_PUBLIC_APP_URL: readOptionalEnv(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_CAL_LINK: readOptionalEnv(process.env.NEXT_PUBLIC_CAL_LINK),
  },
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
});
