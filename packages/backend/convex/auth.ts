import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { env } from "./env";
import { ResendOTP } from "./otp/ResendOTP";
import { withCodeRequestLimit } from "./passwordRecovery/codeRequestLimit";
import { NeutralPassword } from "./passwordRecovery/NeutralPassword";
import { ResendOTPPasswordReset } from "./passwordReset/ResendOTPPasswordReset";

const normalizedEmailProfile = (params: Record<string, unknown>) => {
  if (typeof params.email !== "string" || params.email.trim().length === 0) {
    throw new Error("Email is required");
  }

  return {
    email: params.email.trim().toLowerCase(),
  };
};

const resendLinkSender = Resend({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
}).sendVerificationRequest;

const verifyProvider = Resend({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  sendVerificationRequest: withCodeRequestLimit(resendLinkSender),
});

const magicLinkEmail = Email({
  id: "magic-link",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  authorize: undefined,
  sendVerificationRequest: withCodeRequestLimit(resendLinkSender),
});

const passwordBasic = NeutralPassword({
  id: "password",
  profile: normalizedEmailProfile,
});

const passwordWithReset = NeutralPassword({
  id: "password-with-reset",
  profile: normalizedEmailProfile,
  reset: ResendOTPPasswordReset,
  verify: ResendOTP,
});

const passwordWithCode = NeutralPassword({
  id: "password-code",
  profile: normalizedEmailProfile,
  reset: ResendOTPPasswordReset,
  verify: ResendOTP,
});

const passwordWithEmailLinkVerification = NeutralPassword({
  id: "password-link",
  profile: normalizedEmailProfile,
  verify: verifyProvider,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      if (user?.accountEmailOverride || user?.accountNameOverride) {
        await ctx.db.patch(userId, {
          ...(user.accountEmailOverride
            ? { email: user.accountEmailOverride }
            : {}),
          ...(user.accountNameOverride
            ? { name: user.accountNameOverride }
            : {}),
        });
      }
    },
  },
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
