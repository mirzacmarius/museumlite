import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { env } from "./env";
import { ResendOTP } from "./otp/ResendOTP";
import { ResendOTPPasswordReset } from "./passwordReset/ResendOTPPasswordReset";

const normalizedEmailProfile = (params: Record<string, unknown>) => {
  if (typeof params.email !== "string" || params.email.trim().length === 0) {
    throw new Error("Email is required");
  }

  return {
    email: params.email.trim().toLowerCase(),
  };
};

const verifyProvider = Resend({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
});

const magicLinkEmail = Email({
  id: "magic-link",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  // Match Auth.js Resend provider behavior for magic-link flow.
  authorize: undefined,
  sendVerificationRequest: verifyProvider.sendVerificationRequest,
});

const passwordBasic = Password({
  profile: normalizedEmailProfile,
});

const passwordWithReset = Password({
  id: "password-with-reset",
  profile: normalizedEmailProfile,
  reset: ResendOTPPasswordReset,
  verify: verifyProvider,
});

const passwordWithCode = Password({
  id: "password-code",
  profile: normalizedEmailProfile,
  reset: ResendOTPPasswordReset,
  verify: ResendOTP,
});

const passwordWithEmailLinkVerification = Password({
  id: "password-link",
  profile: normalizedEmailProfile,
  verify: verifyProvider,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    magicLinkEmail,
    ResendOTP,
    passwordBasic,
    passwordWithReset,
    passwordWithCode,
    passwordWithEmailLinkVerification,
  ],
});
