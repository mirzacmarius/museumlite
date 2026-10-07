"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import {
  sendInvitationEmail,
  sendLoanApprovedEmail,
  sendLoanPendingEmail,
  sendLoanRejectedEmail,
  sendOrganizationDeletionFinalNoticeEmail,
  sendOrganizationDeletionGraceEmail,
  sendSubscriptionErrorEmail,
  sendSubscriptionSuccessEmail,
  sendTaskAssignedEmail,
} from "./senders.js";

const emailLocaleValidator = v.optional(
  v.union(
    v.literal("en"),
    v.literal("fr"),
    v.literal("es"),
    v.literal("no"),
    v.literal("ro"),
  ),
);

export const sendInvitationEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    organizationName: v.string(),
    inviterName: v.string(),
    role: v.string(),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendInvitationEmail({ ...args, locale });
    return null;
  },
});

export const sendLoanApprovedEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    loanId: v.string(),
    itemName: v.string(),
    borrowerName: v.string(),
    startDate: v.union(v.number(), v.string()),
    endDate: v.optional(v.union(v.number(), v.string())),
    itemCount: v.optional(v.number()),
    loanUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendLoanApprovedEmail({ ...args, locale });
    return null;
  },
});

export const sendLoanRejectedEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    loanId: v.string(),
    itemName: v.string(),
    borrowerName: v.string(),
    startDate: v.union(v.number(), v.string()),
    endDate: v.optional(v.union(v.number(), v.string())),
    itemCount: v.optional(v.number()),
    loanUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendLoanRejectedEmail({ ...args, locale });
    return null;
  },
});

export const sendLoanPendingEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    loanId: v.string(),
    itemName: v.string(),
    borrowerName: v.string(),
    startDate: v.union(v.number(), v.string()),
    endDate: v.optional(v.union(v.number(), v.string())),
    itemCount: v.optional(v.number()),
    loanUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendLoanPendingEmail({ ...args, locale });
    return null;
  },
});

export const sendTaskAssignedEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    taskTitle: v.string(),
    assignedBy: v.string(),
    dueDate: v.optional(v.union(v.number(), v.string())),
    taskUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendTaskAssignedEmail({ ...args, locale });
    return null;
  },
});

export const sendSubscriptionSuccessEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendSubscriptionSuccessEmail({ ...args, locale });
    return null;
  },
});

export const sendSubscriptionErrorEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendSubscriptionErrorEmail({ ...args, locale });
    return null;
  },
});

export const sendOrganizationDeletionGraceEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    organizationName: v.string(),
    token: v.string(),
    graceEndsAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendOrganizationDeletionGraceEmail({ ...args, locale });
    return null;
  },
});

export const sendOrganizationDeletionFinalNoticeEmailAction = internalAction({
  args: {
    email: v.string(),
    locale: emailLocaleValidator,
    organizationName: v.string(),
    token: v.string(),
    scheduledDeletionDate: v.number(),
    scheduledPurgeAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const locale =
      args.locale ??
      (await ctx.runQuery(internal.userPreferences.getEmailLocaleByEmail, {
        email: args.email,
      }));
    await sendOrganizationDeletionFinalNoticeEmail({ ...args, locale });
    return null;
  },
});
