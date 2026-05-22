"use node";

import { v } from "convex/values";
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

export const sendInvitationEmailAction = internalAction({
  args: {
    email: v.string(),
    organizationName: v.string(),
    inviterName: v.string(),
    role: v.string(),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendInvitationEmail(args);
    return null;
  },
});

export const sendLoanApprovedEmailAction = internalAction({
  args: {
    email: v.string(),
    loanId: v.string(),
    itemName: v.string(),
    borrowerName: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    loanUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendLoanApprovedEmail(args);
    return null;
  },
});

export const sendLoanRejectedEmailAction = internalAction({
  args: {
    email: v.string(),
    loanId: v.string(),
    itemName: v.string(),
    borrowerName: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    loanUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendLoanRejectedEmail(args);
    return null;
  },
});

export const sendLoanPendingEmailAction = internalAction({
  args: {
    email: v.string(),
    loanId: v.string(),
    itemName: v.string(),
    borrowerName: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    loanUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendLoanPendingEmail(args);
    return null;
  },
});

export const sendTaskAssignedEmailAction = internalAction({
  args: {
    email: v.string(),
    taskTitle: v.string(),
    assignedBy: v.string(),
    dueDate: v.optional(v.string()),
    taskUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendTaskAssignedEmail(args);
    return null;
  },
});

export const sendSubscriptionSuccessEmailAction = internalAction({
  args: {
    email: v.string(),
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendSubscriptionSuccessEmail(args);
    return null;
  },
});

export const sendSubscriptionErrorEmailAction = internalAction({
  args: {
    email: v.string(),
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendSubscriptionErrorEmail(args);
    return null;
  },
});

export const sendOrganizationDeletionGraceEmailAction = internalAction({
  args: {
    email: v.string(),
    organizationName: v.string(),
    token: v.string(),
    graceEndsAt: v.number(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendOrganizationDeletionGraceEmail(args);
    return null;
  },
});

export const sendOrganizationDeletionFinalNoticeEmailAction = internalAction({
  args: {
    email: v.string(),
    organizationName: v.string(),
    token: v.string(),
    scheduledDeletionDate: v.number(),
    scheduledPurgeAt: v.number(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await sendOrganizationDeletionFinalNoticeEmail(args);
    return null;
  },
});
