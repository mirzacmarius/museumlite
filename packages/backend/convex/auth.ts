import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { sha256 } from "@oslojs/crypto/sha2";
import { type Infer, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { sendLocalizedMagicLinkEmail } from "./email/authCopy";
import { env } from "./env";
import { ResendOTP } from "./otp/ResendOTP";
import { normalizeAuthRecoveryError } from "./passwordRecovery/authRecoveryErrors";
import {
  codeRequestFlow,
  enforceCodeRequestLimit,
} from "./passwordRecovery/codeRequestLimit";
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

const verifyProvider = Resend({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  sendVerificationRequest: sendLocalizedMagicLinkEmail,
});

const magicLinkEmail = Email({
  id: "magic-link",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  authorize: undefined,
  sendVerificationRequest: sendLocalizedMagicLinkEmail,
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

const configuredAuth = convexAuth({
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
    verifyProvider,
    ResendOTP,
    passwordBasic,
    passwordWithReset,
    passwordWithCode,
    passwordWithEmailLinkVerification,
  ],
});

export const { auth, signOut, isAuthenticated } = configuredAuth;

const signInArgs = {
  provider: v.optional(v.string()),
  params: v.optional(v.any()),
  verifier: v.optional(v.string()),
  refreshToken: v.optional(v.string()),
  calledBy: v.optional(v.string()),
};
const signInReturns = v.union(
  v.object({
    tokens: v.union(
      v.null(),
      v.object({ token: v.string(), refreshToken: v.string() }),
    ),
  }),
  v.object({ redirect: v.string(), verifier: v.string() }),
  v.object({ started: v.boolean() }),
);

export const signIn = action({
  args: signInArgs,
  returns: signInReturns,
  handler: async (ctx, args) => {
    if (
      !("_handler" in configuredAuth.signIn) ||
      typeof configuredAuth.signIn._handler !== "function"
    )
      throw new Error("Unsupported Convex Auth sign-in handler");
    try {
      const result: Infer<typeof signInReturns> =
        await configuredAuth.signIn._handler(ctx, args);
      return result;
    } catch (error) {
      throw normalizeAuthRecoveryError(error);
    }
  },
});

// Keep credential activation inside the same transaction as code redemption,
// including code-only magic-link callbacks handled directly by Convex Auth.
export const store = internalMutation({
  args: { args: v.any() },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.args.type === "createVerificationCode") {
      const accountId: Id<"authAccounts"> | undefined = args.args.accountId;
      const account = accountId ? await ctx.db.get(accountId) : null;
      const email = args.args.email;
      if (typeof email !== "string")
        throw new Error("Email is required for auth code requests");
      await enforceCodeRequestLimit(
        ctx,
        email,
        codeRequestFlow(
          args.args.provider,
          account?.provider.startsWith("password") ?? false,
        ),
      );
    }
    const code =
      args.args.type === "verifyCodeAndSignIn" &&
      typeof args.args.params?.code === "string"
        ? await ctx.db
            .query("authVerificationCodes")
            .withIndex("code", (q) =>
              q.eq(
                "code",
                Array.from(
                  sha256(new TextEncoder().encode(args.args.params.code)),
                  (byte) => byte.toString(16).padStart(2, "0"),
                ).join(""),
              ),
            )
            .unique()
        : null;
    if (
      !("_handler" in configuredAuth.store) ||
      typeof configuredAuth.store._handler !== "function"
    ) {
      throw new Error("Unsupported Convex Auth store handler");
    }
    const account = code ? await ctx.db.get(code.accountId) : null;
    const result: unknown = await configuredAuth.store._handler(ctx, args);
    if (
      code &&
      account &&
      result !== null &&
      typeof result === "object" &&
      "userId" in result &&
      result.userId === account.userId
    ) {
      if (code.pendingPasswordHash) {
        await ctx.db.patch(code.accountId, {
          secret: code.pendingPasswordHash,
        });
        if ("sessionId" in result) {
          await configuredAuth.store._handler(ctx, {
            args: {
              type: "invalidateSessions",
              userId: account.userId,
              except: [result.sessionId],
            },
          });
        }
      } else if (
        !account.emailVerified &&
        account.provider.startsWith("password")
      ) {
        // A reset code redeemed directly must not activate a pre-registered secret.
        await ctx.db.patch(account._id, { secret: undefined });
      }
    }
    return result;
  },
});
