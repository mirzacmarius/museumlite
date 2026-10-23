import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalQuery, type MutationCtx } from "./_generated/server";
import {
  EMAIL_ACCOUNT_PROVIDERS,
  PASSWORD_PROVIDERS,
} from "./accountConstants";
import { releaseUnprovenSecret } from "./passwordRecovery/unprovenSecrets";
import { internalMutation } from "./utils/mutationBuilders";

const passwordAccountValidator = v.object({
  accountId: v.id("authAccounts"),
  provider: v.string(),
  providerAccountId: v.string(),
  secret: v.string(),
});
const passwordProviderSet = new Set(PASSWORD_PROVIDERS);

export const getPasswordAccounts = internalQuery({
  args: {},
  returns: v.array(passwordAccountValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .take(33);
    if (accounts.length > 32) throw new Error("Too many linked accounts");
    const passwordAccounts: Infer<typeof passwordAccountValidator>[] = [];
    for (const account of accounts) {
      if (!passwordProviderSet.has(account.provider) || !account.secret) {
        continue;
      }
      passwordAccounts.push({
        accountId: account._id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        secret: account.secret,
      });
    }
    return passwordAccounts;
  },
});

export const commitPasswordChange = internalMutation({
  args: {
    accounts: v.array(passwordAccountValidator),
    newHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { accounts, newHash }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    if (accounts.length === 0 || !newHash) {
      throw new ConvexError({ code: "PASSWORD_UNAVAILABLE" });
    }
    const current = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .take(33);
    if (current.length > 32) throw new Error("Too many linked accounts");
    const passwordAccounts = current.filter(
      (account) =>
        PASSWORD_PROVIDERS.includes(account.provider) &&
        Boolean(account.secret),
    );
    if (passwordAccounts.length !== accounts.length) {
      throw new ConvexError({ code: "ACCOUNT_CHANGED" });
    }
    const originals = new Map(
      accounts.map((account) => [account.accountId, account]),
    );
    for (const account of passwordAccounts) {
      const original = originals.get(account._id);
      if (
        !original ||
        original.provider !== account.provider ||
        original.providerAccountId !== account.providerAccountId ||
        original.secret !== account.secret ||
        account.userId !== userId
      ) {
        throw new ConvexError({ code: "ACCOUNT_CHANGED" });
      }
    }
    for (const account of passwordAccounts) {
      await ctx.db.patch(account._id, { secret: newHash });
    }
    const currentSessionId = await getAuthSessionId(ctx);
    await ctx.runMutation(internal.auth.store, {
      args: {
        type: "invalidateSessions",
        userId,
        except: currentSessionId ? [currentSessionId] : [],
      },
    });
    return null;
  },
});

async function assertEmailAvailable(
  ctx: MutationCtx,
  email: string,
  userId: Id<"users">,
) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  if (users.some((user) => user._id !== userId)) {
    throw new ConvexError({ code: "EMAIL_IN_USE" });
  }
  for (const provider of EMAIL_ACCOUNT_PROVIDERS) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", provider).eq("providerAccountId", email),
      )
      .unique();
    if (account) throw new ConvexError({ code: "EMAIL_IN_USE" });
  }
}

export const prepareEmailChange = internalMutation({
  args: { email: v.string(), codeHash: v.string() },
  returns: v.null(),
  handler: async (ctx, { email, codeHash }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    if (user.email?.toLowerCase() === email) {
      throw new ConvexError({ code: "EMAIL_UNCHANGED" });
    }
    await assertEmailAvailable(ctx, email, userId);
    const pending = await ctx.db
      .query("accountEmailChanges")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    if (pending && pending.lastSentAt + 60_000 > now) {
      throw new ConvexError({ code: "EMAIL_SEND_THROTTLED" });
    }
    const change = {
      email,
      codeHash,
      expiresAt: now + 20 * 60_000,
      attemptsLeft: 5,
      lastSentAt: now,
      cancelled: false,
    };
    if (pending) await ctx.db.patch(pending._id, change);
    else await ctx.db.insert("accountEmailChanges", { userId, ...change });
    return null;
  },
});

export const cancelFailedEmailSend = internalMutation({
  args: { codeHash: v.string() },
  returns: v.null(),
  handler: async (ctx, { codeHash }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const pending = await ctx.db
      .query("accountEmailChanges")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (pending?.codeHash === codeHash) await ctx.db.delete(pending._id);
    return null;
  },
});

export const confirmEmailChange = internalMutation({
  args: { codeHash: v.string() },
  returns: v.union(
    v.literal("changed"),
    v.literal("invalid_code"),
    v.literal("expired"),
    v.literal("missing"),
  ),
  handler: async (ctx, { codeHash }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    const pending = await ctx.db
      .query("accountEmailChanges")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!pending) return "missing";
    if (pending.cancelled || pending.attemptsLeft <= 0) return "missing";
    if (pending.expiresAt <= Date.now()) {
      await ctx.db.delete(pending._id);
      return "expired";
    }
    if (pending.codeHash !== codeHash) {
      await ctx.db.patch(pending._id, {
        attemptsLeft: pending.attemptsLeft - 1,
      });
      return "invalid_code";
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });
    await assertEmailAvailable(ctx, pending.email, userId);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .take(33);
    if (accounts.length > 32) throw new Error("Too many linked accounts");
    const emailAccounts = accounts.filter((account) =>
      EMAIL_ACCOUNT_PROVIDERS.includes(account.provider),
    );
    if (
      new Set(emailAccounts.map((account) => account.provider)).size !==
      emailAccounts.length
    ) {
      throw new ConvexError({ code: "MULTIPLE_EMAIL_ACCOUNTS" });
    }
    for (const account of emailAccounts) {
      const verificationCode = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .unique();
      if (verificationCode) await ctx.db.delete(verificationCode._id);
      // Marking the account verified would make an unproven password work.
      await releaseUnprovenSecret(ctx, account);
      await ctx.db.patch(account._id, {
        providerAccountId: pending.email,
        emailVerified: pending.email,
      });
    }
    await ctx.db.patch(userId, {
      email: pending.email,
      emailVerificationTime: Date.now(),
      accountEmailOverride: pending.email,
    });
    await ctx.db.delete(pending._id);
    return "changed";
  },
});
