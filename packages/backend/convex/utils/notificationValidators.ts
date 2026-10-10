import { type Infer, v } from "convex/values";
import {
  deliveryAttemptLedgerFields,
  deliveryLedgerFields,
} from "./deliveryLedger";
import { notificationCategory } from "./notificationTypes";

/** Structured content for the richer loan and task email layouts. */
export const notificationEmailDetails = v.union(
  v.object({
    kind: v.union(
      v.literal("loanApproved"),
      v.literal("loanRejected"),
      v.literal("loanPending"),
    ),
    loanId: v.string(),
    itemName: v.string(),
    itemCount: v.optional(v.number()),
    borrowerName: v.string(),
    startDate: v.union(v.number(), v.string()),
    endDate: v.optional(v.union(v.number(), v.string())),
  }),
  v.object({
    kind: v.literal("taskAssigned"),
    taskTitle: v.string(),
    assignedBy: v.string(),
    dueDate: v.optional(v.union(v.number(), v.string())),
  }),
);
export type NotificationEmailDetails = Infer<typeof notificationEmailDetails>;

/** One logical event an emitter notified about, captured when it happened. */
export const notificationIntentFields = {
  organizationId: v.id("organizations"),
  type: v.string(),
  category: notificationCategory,
  title: v.string(),
  message: v.string(),
  relatedEntityType: v.optional(v.string()),
  relatedEntityId: v.optional(v.string()),
  emailDetails: v.optional(notificationEmailDetails),
  /** Emitter's key for the event; dispatching it again changes nothing. */
  idempotencyKey: v.optional(v.string()),
};

/**
 * Why an email attempt failed or was never sent. Besides transport failures,
 * a delivery is cancelled when the recipient may no longer receive it.
 */
export const notificationEmailErrorCode = v.union(
  v.literal("http_error"),
  v.literal("timeout"),
  v.literal("network_error"),
  v.literal("attempt_lost"),
  v.literal("event_expired"),
  v.literal("recipient_removed"),
  v.literal("access_revoked"),
  v.literal("email_disabled"),
  v.literal("address_missing"),
  v.literal("channel_unavailable"),
);
export type NotificationEmailErrorCode = Infer<
  typeof notificationEmailErrorCode
>;

export const notificationEmailDeliveryFields = {
  organizationId: v.id("organizations"),
  intentId: v.id("notificationIntents"),
  userId: v.id("users"),
  /** The in-app notification this email accompanies. */
  notificationId: v.id("notifications"),
  ...deliveryLedgerFields,
  lastErrorCode: v.optional(notificationEmailErrorCode),
  /** Message id the provider returned for the successful attempt. */
  providerMessageId: v.optional(v.string()),
};

export const notificationEmailAttemptFields = {
  organizationId: v.id("organizations"),
  deliveryId: v.id("notificationEmailDeliveries"),
  ...deliveryAttemptLedgerFields,
  errorCode: v.optional(notificationEmailErrorCode),
};
