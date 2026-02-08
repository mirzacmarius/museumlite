import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { env } from "./env";

const verifyProvider =
  env.RESEND_API_KEY && env.RESEND_SENDER_EMAIL_AUTH
    ? Resend({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_SENDER_EMAIL_AUTH,
      })
    : undefined;

const password = Password({
  profile: (params) => {
    if (typeof params.email !== "string" || params.email.trim().length === 0) {
      throw new Error("Email is required");
    }

    return {
      email: params.email.trim().toLowerCase(),
    };
  },
  ...(verifyProvider ? { verify: verifyProvider } : {}),
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password, Google],
});
