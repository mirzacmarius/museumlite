"use node";

import { getAuthUserId, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  type AccountErrorResult,
  accountErrorResultValidator,
  expectedAccountError,
} from "./accountErrors";
import { sendEmail } from "./email";
import { buildAuthCodeEmail, getEmailTranslations } from "./email/translations";
import { env } from "./env";
import { generateVerificationCode } from "./utils/verificationCode";

async function hashEmailCode(code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.RESEND_API_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code)),
  );
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export const requestEmailChange = action({
  args: { newEmail: v.string() },
  returns: v.union(
    v.object({ status: v.literal("sent") }),
    accountErrorResultValidator,
  ),
  handler: async (
    ctx,
    { newEmail },
  ): Promise<{ status: "sent" } | AccountErrorResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { status: "error", code: "UNAUTHENTICATED" };
    }
    const locale = await ctx.runQuery(
      internal.userPreferences.getEmailLocaleByUserId,
      { userId },
    );
    const email = newEmail.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { status: "error", code: "INVALID_EMAIL" };
    }
    const code = generateVerificationCode();
    const codeHash = await hashEmailCode(code);
    try {
      await ctx.runMutation(internal.accountMutations.prepareEmailChange, {
        email,
        codeHash,
      });
    } catch (error) {
      const expected = expectedAccountError(error);
      if (expected) return expected;
      throw error;
    }
    try {
      const emailCopy = buildAuthCodeEmail({
        locale,
        subject: getEmailTranslations(locale).auth.emailChangeSubject,
        body: getEmailTranslations(locale).auth.emailChangeBody,
        token: code,
        additionalMessage: getEmailTranslations(locale).auth.expires,
      });
      await sendEmail({ to: email, ...emailCopy });
    } catch (error) {
      await ctx.runMutation(internal.accountMutations.cancelFailedEmailSend, {
        codeHash,
      });
      throw error;
    }
    return { status: "sent" };
  },
});

export const confirmEmailChange = action({
  args: { code: v.string() },
  returns: v.union(
    v.object({ status: v.literal("changed") }),
    accountErrorResultValidator,
  ),
  handler: async (
    ctx,
    { code },
  ): Promise<{ status: "changed" } | AccountErrorResult> => {
    if (!(await getAuthUserId(ctx))) {
      return { status: "error", code: "UNAUTHENTICATED" };
    }
    if (!/^\d{8}$/.test(code)) {
      return { status: "error", code: "INVALID_CODE" };
    }
    const codeHash = await hashEmailCode(code);
    let result: "changed" | "invalid_code" | "expired" | "missing";
    try {
      result = await ctx.runMutation(
        internal.accountMutations.confirmEmailChange,
        { codeHash },
      );
    } catch (error) {
      const expected = expectedAccountError(error);
      if (expected) return expected;
      throw error;
    }
    if (result === "missing") {
      return { status: "error", code: "NO_PENDING_EMAIL_CHANGE" };
    }
    if (result === "expired") {
      return { status: "error", code: "EMAIL_CODE_EXPIRED" };
    }
    if (result === "invalid_code") {
      return { status: "error", code: "INVALID_CODE" };
    }
    return { status: "changed" };
  },
});

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.union(
        v.literal("changed"),
        v.literal("password_unavailable"),
        v.literal("invalid_current_password"),
      ),
    }),
    accountErrorResultValidator,
  ),
  handler: async (
    ctx,
    { currentPassword, newPassword },
  ): Promise<
    | {
        status: "changed" | "password_unavailable" | "invalid_current_password";
      }
    | AccountErrorResult
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "error", code: "UNAUTHENTICATED" };
    if (newPassword.length < 8 || newPassword.length > 1024) {
      return { status: "error", code: "INVALID_NEW_PASSWORD" };
    }
    if (currentPassword === newPassword) {
      return { status: "error", code: "PASSWORD_UNCHANGED" };
    }
    try {
      const accounts = await ctx.runQuery(
        internal.accountMutations.getPasswordAccounts,
        {},
      );
      if (accounts.length === 0) return { status: "password_unavailable" };
      let hasVerifiedCurrentPassword = false;
      let isRateLimited = false;
      for (const account of accounts) {
        try {
          const retrieved = await retrieveAccount(ctx, {
            provider: account.provider,
            account: {
              id: account.providerAccountId,
              secret: currentPassword,
            },
          });
          if (
            retrieved.user._id === userId &&
            retrieved.account._id === account.accountId
          ) {
            hasVerifiedCurrentPassword = true;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : null;
          if (
            errorMessage === "InvalidSecret" ||
            errorMessage === "InvalidAccountId"
          ) {
            continue;
          }
          if (errorMessage === "TooManyFailedAttempts") {
            isRateLimited = true;
            continue;
          }
          throw error;
        }
      }
      if (!hasVerifiedCurrentPassword) {
        return isRateLimited
          ? { status: "error", code: "PASSWORD_RATE_LIMITED" }
          : { status: "invalid_current_password" };
      }
      const newHash = await new Scrypt().hash(newPassword);
      await ctx.runMutation(internal.accountMutations.commitPasswordChange, {
        accounts,
        newHash,
      });
      return { status: "changed" };
    } catch (error) {
      const expected = expectedAccountError(error);
      if (expected?.code === "PASSWORD_UNAVAILABLE") {
        return { status: "password_unavailable" };
      }
      if (expected) return expected;
      throw error;
    }
  },
});
