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
  v.literal("digest_empty"),
);
export type NotificationEmailErrorCode = Infer<
  typeof notificationEmailErrorCode
>;

export const digestCadence = v.union(v.literal("daily"), v.literal("weekly"));
export type DigestCadence = Infer<typeof digestCadence>;

const emailDeliveryFields = {
  organizationId: v.id("organizations"),
  userId: v.id("users"),
  ...deliveryLedgerFields,
  lastErrorCode: v.optional(notificationEmailErrorCode),
  /** Message id the provider returned for the successful attempt. */
  providerMessageId: v.optional(v.string()),
};

/**
 * One email to one recipient on the delivery ledger: an instant email that
 * accompanies one notification, or a digest that groups the notifications
 * listed in `notificationDigestItems` (ADR 0010).
 */
export const notificationEmailDeliveryFields = v.union(
  v.object({
    ...emailDeliveryFields,
    /** Absent on instant emails stored before digests existed. */
    kind: v.optional(v.literal("instant")),
    intentId: v.id("notificationIntents"),
    /** The in-app notification this email accompanies. */
    notificationId: v.id("notifications"),
  }),
  v.object({
    ...emailDeliveryFields,
    kind: v.literal("digest"),
    cadence: digestCadence,
    /** The digest time its first attempt is due at. */
    scheduledFor: v.number(),
    /** Notifications collected so far; a digest holds `DIGEST_ITEM_LIMIT` at most. */
    itemCount: v.number(),
  }),
);

/** A notification waiting in, or sent with, one digest. */
export const notificationDigestItemFields = {
  organizationId: v.id("organizations"),
  deliveryId: v.id("notificationEmailDeliveries"),
  notificationId: v.id("notifications"),
  /** Why the latest attempt left the notification out; absent when it was listed. */
  excludedReason: v.optional(notificationEmailErrorCode),
};

export const notificationEmailAttemptFields = {
  organizationId: v.id("organizations"),
  deliveryId: v.id("notificationEmailDeliveries"),
  ...deliveryAttemptLedgerFields,
  errorCode: v.optional(notificationEmailErrorCode),
};
