import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import { emailLocaleOf, emailLocaleValidator } from "./userPreferences";
import { isTimeZone } from "./utils/calendarSchedule";
import {
  attemptOutcome,
  claimStep,
  DELIVERY_MAX_ATTEMPTS,
  DELIVERY_RETENTION_MS,
  DELIVERY_SWEEP_GRACE_MS,
  deliveryStatus,
  finishedWithoutSending,
  isRetryableStatus,
  ledgerProgress,
  resultStep,
  retrySeriesPatch,
} from "./utils/deliveryLedger";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import {
  DIGEST_ITEM_LIMIT,
  type DigestDelivery,
} from "./utils/notificationDigests";
import { emailCadence, recipientAccess } from "./utils/notificationDispatch";
import { notificationEmailChannel } from "./utils/notificationEmailChannel";
import {
  type NotificationErrorCode,
  notificationError,
} from "./utils/notificationErrors";
import { notificationEntityHref } from "./utils/notificationLinks";
import {
  type ChannelPolicy,
  channelPolicy,
  storedPreferences,
} from "./utils/notificationPreferences";
import {
  categoryOfType,
  notificationCategory,
  readPermissionForEntity,
} from "./utils/notificationTypes";
import {
  digestCadence,
  type NotificationEmailErrorCode,
  notificationEmailDetails,
  notificationEmailErrorCode,
} from "./utils/notificationValidators";

const DISPATCH_BATCH = 100;
const ATTEMPT_HISTORY_LIMIT = 50;

/** One email's delivery state and newest attempts; null for anyone but its recipient. */
export const get = query({
  args: { deliveryId: v.id("notificationEmailDeliveries") },
  returns: v.union(
    v.object({
      delivery: v.object({
        _id: v.id("notificationEmailDeliveries"),
        _creationTime: v.number(),
        /** The notification an instant email accompanies; absent for a digest. */
        notificationId: v.optional(v.id("notifications")),
        digest: v.optional(
          v.object({
            cadence: digestCadence,
            scheduledFor: v.number(),
            notificationCount: v.number(),
          }),
        ),
        status: deliveryStatus,
        attemptCount: v.number(),
        maxAttempts: v.number(),
        seriesAttempts: v.number(),
        inFlight: v.boolean(),
        nextAttemptAt: v.optional(v.number()),
        lastAttemptAt: v.optional(v.number()),
        lastResponseStatus: v.optional(v.number()),
        lastErrorCode: v.optional(notificationEmailErrorCode),
        retryCount: v.number(),
        completedAt: v.optional(v.number()),
      }),
      attempts: v.array(
        v.object({
          attemptNumber: v.number(),
          startedAt: v.number(),
          durationMs: v.number(),
          outcome: attemptOutcome,
          responseStatus: v.optional(v.number()),
          errorCode: v.optional(notificationEmailErrorCode),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const delivery = await ctx.db.get(args.deliveryId);
    if (!userId || !delivery || delivery.userId !== userId) {
      return null;
    }
    const attempts = await ctx.db
      .query("notificationEmailAttempts")
      .withIndex("by_deliveryId_and_attemptNumber", (q) =>
        q.eq("deliveryId", delivery._id),
      )
      .order("desc")
      .take(ATTEMPT_HISTORY_LIMIT);
    return {
      delivery: {
        _id: delivery._id,
        _creationTime: delivery._creationTime,
        ...(delivery.kind === "digest"
          ? {
              digest: {
                cadence: delivery.cadence,
                scheduledFor: delivery.scheduledFor,
                notificationCount: delivery.itemCount,
              },
            }
          : { notificationId: delivery.notificationId }),
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        maxAttempts: delivery.maxAttempts,
        ...ledgerProgress(delivery),
        lastAttemptAt: delivery.lastAttemptAt,
        lastResponseStatus: delivery.lastResponseStatus,
        lastErrorCode: delivery.lastErrorCode,
        retryCount: delivery.retryCount,
        completedAt: delivery.completedAt,
      },
      attempts: attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        durationMs: attempt.durationMs,
        outcome: attempt.outcome,
        responseStatus: attempt.responseStatus,
        errorCode: attempt.errorCode,
      })),
    };
  },
});

/** Schedules the first attempt of each email delivery of an intent. */
export const dispatchIntent = internalMutation({
  args: {
    intentId: v.id("notificationIntents"),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("notificationEmailDeliveries")
      .withIndex("by_intentId", (q) => q.eq("intentId", args.intentId))
      .paginate({ numItems: DISPATCH_BATCH, cursor: args.cursor ?? null });
    for (const delivery of page.page) {
      if (delivery.status === "pending" && delivery.attemptCount === 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.notificationEmailsActions.attemptDelivery,
          { deliveryId: delivery._id, attempt: 1 },
        );
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.notificationEmails.dispatchIntent,
        { intentId: args.intentId, cursor: page.continueCursor },
      );
    }
    return null;
  },
});

type Ineligibility = Exclude<
  NotificationEmailErrorCode,
  "http_error" | "timeout" | "network_error" | "attempt_lost"
>;

type InstantDelivery = Exclude<
  Doc<"notificationEmailDeliveries">,
  { kind: "digest" }
>;

/** A run that starts before its delivery is due belongs to a digest moved later. */
const EARLY_RUN_TOLERANCE_MS = 1_000;

const emailContent = v.union(
  v.object({
    kind: v.literal("instant"),
    organizationName: v.string(),
    category: notificationCategory,
    title: v.string(),
    message: v.string(),
    actionPath: v.string(),
    details: v.optional(notificationEmailDetails),
  }),
  v.object({
    kind: v.literal("digest"),
    organizationName: v.string(),
    cadence: digestCadence,
    /** Time zone the listed notification times are shown in. */
    timezone: v.string(),
    notifications: v.array(
      v.object({
        id: v.id("notifications"),
        category: notificationCategory,
        title: v.string(),
        message: v.string(),
        actionPath: v.string(),
        createdAt: v.number(),
      }),
    ),
  }),
);

type EmailMessage =
  | { kind: "ineligible"; reason: Ineligibility }
  | {
      kind: "send";
      to: string;
      idempotencyKey: string;
      content: Infer<typeof emailContent>;
    };

/**
 * Whether the recipient may still be emailed by the organization at all:
 * a current member with an address, on a deployment that sends email.
 */
async function recipientEmail(
  ctx: MutationCtx,
  access: ReturnType<typeof recipientAccess>,
  delivery: Doc<"notificationEmailDeliveries">,
): Promise<
  | { kind: "ineligible"; reason: Ineligibility }
  | {
      kind: "eligible";
      to: string;
      preferences: Doc<"notificationPreferences"> | null;
      policy: ChannelPolicy;
    }
> {
  const recipient = await access.check(delivery.userId, null);
  if (recipient.kind !== "allowed") {
    return { kind: "ineligible", reason: "recipient_removed" };
  }
  if (!recipient.user.email) {
    return { kind: "ineligible", reason: "address_missing" };
  }
  if (notificationEmailChannel().kind === "unavailable") {
    return { kind: "ineligible", reason: "channel_unavailable" };
  }
  const preferences = await storedPreferences(
    ctx,
    delivery.userId,
    delivery.organizationId,
  );
  return {
    kind: "eligible",
    to: recipient.user.email,
    preferences,
    policy: channelPolicy(preferences),
  };
}

/**
 * Why one notification may not be emailed to the recipient now, or null when
 * it may: its category must still be emailed and its record still readable.
 * Checked again before every attempt and every retry, because time passes
 * between the event and the send.
 */
async function notificationIneligibility(
  access: ReturnType<typeof recipientAccess>,
  userId: Id<"users">,
  policy: ChannelPolicy,
  notification: { type: string; relatedEntityType?: string },
): Promise<Ineligibility | null> {
  if (
    emailCadence(
      policy,
      categoryOfType(notification.type),
      notification.type,
    ) === null
  ) {
    return "email_disabled";
  }
  const readPermission =
    notification.relatedEntityType === undefined
      ? null
      : readPermissionForEntity(notification.relatedEntityType);
  if (readPermission === undefined) return "access_revoked";
  const recipient = await access.check(userId, readPermission);
  return recipient.kind === "allowed" ? null : "access_revoked";
}

/** The email that accompanies one notification, as its intent captured it. */
async function instantMessage(
  ctx: MutationCtx,
  delivery: InstantDelivery,
): Promise<EmailMessage> {
  const [intent, organization] = await Promise.all([
    ctx.db.get(delivery.intentId),
    ctx.db.get(delivery.organizationId),
  ]);
  if (!intent || !organization) {
    return { kind: "ineligible", reason: "event_expired" };
  }
  const access = recipientAccess(ctx, delivery.organizationId);
  const recipient = await recipientEmail(ctx, access, delivery);
  if (recipient.kind === "ineligible") return recipient;
  const reason = await notificationIneligibility(
    access,
    delivery.userId,
    recipient.policy,
    intent,
  );
  if (reason) return { kind: "ineligible", reason };
  return {
    kind: "send",
    to: recipient.to,
    idempotencyKey: `${delivery._id}:${delivery.seriesStartAttempt}`,
    content: {
      kind: "instant",
      organizationName: organization.name,
      category: intent.category,
      title: intent.title,
      message: intent.message,
      actionPath:
        notificationEntityHref(
          intent.relatedEntityType,
          intent.relatedEntityId,
        ) ?? "/notifications",
      details: intent.emailDetails,
    },
  };
}

/** Short stable fingerprint of the notifications one digest attempt lists. */
async function listFingerprint(ids: readonly string[]) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ids.join(",")),
  );
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

interface DigestExclusion {
  itemId: Id<"notificationDigestItems">;
  /** Undefined when a notification left out before is listed again. */
  reason: Ineligibility | undefined;
}

/**
 * A digest lists the notifications it collected that may still be emailed,
 * each checked again like an instant email. `exclusions` records why the
 * others are left out. The provider key names the listed notifications, so
 * a resend of the same list is deduplicated, and a shorter list after an
 * access change is a new email rather than a refused one.
 */
async function digestMessage(
  ctx: MutationCtx,
  delivery: DigestDelivery,
): Promise<{ message: EmailMessage; exclusions: DigestExclusion[] }> {
  const organization = await ctx.db.get(delivery.organizationId);
  if (!organization) {
    return {
      message: { kind: "ineligible", reason: "event_expired" },
      exclusions: [],
    };
  }
  const access = recipientAccess(ctx, delivery.organizationId);
  const recipient = await recipientEmail(ctx, access, delivery);
  if (recipient.kind === "ineligible") {
    return { message: recipient, exclusions: [] };
  }
  const items = await ctx.db
    .query("notificationDigestItems")
    .withIndex("by_deliveryId", (q) => q.eq("deliveryId", delivery._id))
    .take(DIGEST_ITEM_LIMIT);
  const listed: Array<Doc<"notifications">> = [];
  const exclusions: DigestExclusion[] = [];
  for (const item of items) {
    const notification = await ctx.db.get(item.notificationId);
    const reason = notification
      ? await notificationIneligibility(
          access,
          delivery.userId,
          recipient.policy,
          notification,
        )
      : "event_expired";
    if (notification && reason === null) listed.push(notification);
    if ((reason ?? undefined) !== item.excludedReason) {
      exclusions.push({ itemId: item._id, reason: reason ?? undefined });
    }
  }
  if (listed.length === 0) {
    return {
      message: { kind: "ineligible", reason: "digest_empty" },
      exclusions,
    };
  }
  const savedTimezone = recipient.preferences?.timezone;
  const timezone =
    savedTimezone && isTimeZone(savedTimezone) ? savedTimezone : "UTC";
  const fingerprint = await listFingerprint(listed.map(({ _id }) => _id));
  return {
    message: {
      kind: "send",
      to: recipient.to,
      idempotencyKey: `${delivery._id}:${delivery.seriesStartAttempt}:${fingerprint}`,
      content: {
        kind: "digest",
        organizationName: organization.name,
        cadence: delivery.cadence,
        timezone,
        notifications: listed.map((notification) => ({
          id: notification._id,
          category: categoryOfType(notification.type),
          title: notification.title,
          message: notification.message,
          actionPath:
            notificationEntityHref(
              notification.relatedEntityType,
              notification.relatedEntityId,
            ) ?? "/notifications",
          createdAt: notification.createdAt,
        })),
      },
    },
    exclusions,
  };
}

/** What to send for a delivery now, with a digest's left-out notifications. */
async function emailMessage(
  ctx: MutationCtx,
  delivery: Doc<"notificationEmailDeliveries">,
): Promise<{ message: EmailMessage; exclusions: DigestExclusion[] }> {
  return delivery.kind === "digest"
    ? await digestMessage(ctx, delivery)
    : { message: await instantMessage(ctx, delivery), exclusions: [] };
}

async function finishWithoutSending(
  ctx: MutationCtx,
  delivery: Doc<"notificationEmailDeliveries">,
  status: "cancelled" | "failed_transient",
  errorCode: NotificationEmailErrorCode,
) {
  await ctx.db.patch(delivery._id, {
    ...finishedWithoutSending(status, Date.now()),
    lastErrorCode: errorCode,
  });
  return { kind: "skip" as const };
}

const claimResult = v.union(
  v.object({ kind: v.literal("skip") }),
  v.object({
    kind: v.literal("send"),
    to: v.string(),
    locale: emailLocaleValidator,
    idempotencyKey: v.string(),
    content: emailContent,
  }),
);

/**
 * Claims attempt `attempt` of a pending email delivery and returns what to
 * send. Stale, duplicate or early runs are no-ops; a recipient who may no
 * longer be emailed cancels the delivery without sending.
 */
export const claimAttempt = internalMutation({
  args: {
    deliveryId: v.id("notificationEmailDeliveries"),
    attempt: v.number(),
  },
  returns: claimResult,
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    const now = Date.now();
    if (
      !delivery ||
      (delivery.nextAttemptAt ?? now) > now + EARLY_RUN_TOLERANCE_MS
    ) {
      return { kind: "skip" as const };
    }
    const step = claimStep(delivery, args.attempt, now);
    if (step.kind === "stale") {
      return { kind: "skip" as const };
    }
    if (step.lostAttempt) {
      await ctx.db.insert("notificationEmailAttempts", {
        organizationId: delivery.organizationId,
        deliveryId: delivery._id,
        ...step.lostAttempt,
      });
    }
    if (step.kind === "exhausted") {
      return await finishWithoutSending(
        ctx,
        delivery,
        "failed_transient",
        "attempt_lost",
      );
    }
    const { message, exclusions } = await emailMessage(ctx, delivery);
    for (const { itemId, reason } of exclusions) {
      await ctx.db.patch(itemId, { excludedReason: reason });
    }
    if (message.kind === "ineligible") {
      return await finishWithoutSending(
        ctx,
        delivery,
        "cancelled",
        message.reason,
      );
    }

    await ctx.db.patch(delivery._id, step.patch);
    return {
      kind: "send" as const,
      to: message.to,
      locale: await emailLocaleOf(ctx, delivery.userId),
      idempotencyKey: message.idempotencyKey,
      content: message.content,
    };
  },
});

/**
 * Stores the result of the attempt in flight and schedules the next one with
 * backoff. Results for any other attempt are ignored.
 */
export const recordAttemptResult = internalMutation({
  args: {
    deliveryId: v.id("notificationEmailDeliveries"),
    attempt: v.number(),
    startedAt: v.number(),
    durationMs: v.number(),
    outcome: attemptOutcome,
    responseStatus: v.optional(v.number()),
    errorCode: v.optional(notificationEmailErrorCode),
    providerMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) {
      return null;
    }
    const step = resultStep(delivery, args, Date.now());
    if (step.kind === "stale") {
      return null;
    }
    await ctx.db.insert("notificationEmailAttempts", {
      organizationId: delivery.organizationId,
      deliveryId: delivery._id,
      attemptNumber: args.attempt,
      startedAt: args.startedAt,
      durationMs: args.durationMs,
      outcome: args.outcome,
      responseStatus: args.responseStatus,
      errorCode: args.errorCode,
    });
    await ctx.db.patch(delivery._id, {
      ...step.patch,
      lastErrorCode: args.errorCode,
      providerMessageId: args.providerMessageId,
    });
    if (step.kind === "retry") {
      await ctx.scheduler.runAt(
        step.nextAttemptAt,
        internal.notificationEmailsActions.attemptDelivery,
        { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
      );
    }
    return null;
  },
});

const RETRY_BLOCKED: Record<Ineligibility, NotificationErrorCode> = {
  event_expired: "EMAIL_DELIVERY_NOT_FOUND",
  recipient_removed: "NOT_ORGANIZATION_MEMBER",
  access_revoked: "NOTIFICATION_ACCESS_REVOKED",
  email_disabled: "EMAIL_OFF_FOR_CATEGORY",
  address_missing: "EMAIL_ADDRESS_MISSING",
  channel_unavailable: "EMAIL_CHANNEL_UNAVAILABLE",
  digest_empty: "DIGEST_EMPTY",
};

/**
 * The recipient starts a new attempt series for their own failed or cancelled
 * email. An instant email resends its captured intent; a digest lists again
 * the notifications it collected that may still be emailed.
 */
export const retry = mutation({
  args: { deliveryId: v.id("notificationEmailDeliveries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.userId !== userId) {
      throw notificationError("EMAIL_DELIVERY_NOT_FOUND");
    }
    if (!isRetryableStatus(delivery.status)) {
      throw notificationError("EMAIL_DELIVERY_NOT_RETRYABLE");
    }
    const { message } = await emailMessage(ctx, delivery);
    if (message.kind === "ineligible") {
      throw notificationError(RETRY_BLOCKED[message.reason]);
    }

    await ctx.db.patch(
      delivery._id,
      retrySeriesPatch(delivery, userId, DELIVERY_MAX_ATTEMPTS, Date.now()),
    );
    await ctx.scheduler.runAfter(
      0,
      internal.notificationEmailsActions.attemptDelivery,
      { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
    );
    return null;
  },
});

const SWEEP_BATCH = 100;
const PURGE_BATCH = 20;
const PURGE_DOCUMENT_BUDGET = 400;

/**
 * Cron entry point. Reschedules pending emails whose attempt is overdue (a
 * lost scheduled run, a digest whose time passed unsent, or an expired
 * in-flight lease), then starts the retention purge when email logs or
 * intents have aged out.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = await ctx.db
      .query("notificationEmailDeliveries")
      .withIndex("by_status_and_nextAttemptAt", (q) =>
        q
          .eq("status", "pending")
          .lte("nextAttemptAt", now - DELIVERY_SWEEP_GRACE_MS),
      )
      .take(SWEEP_BATCH);
    for (const delivery of overdue) {
      await ctx.db.patch(delivery._id, { nextAttemptAt: now });
      await ctx.scheduler.runAfter(
        0,
        internal.notificationEmailsActions.attemptDelivery,
        { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
      );
    }

    const cutoff = now - DELIVERY_RETENTION_MS;
    const expired =
      (await ctx.db
        .query("notificationEmailDeliveries")
        .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
        .first()) ??
      (await ctx.db
        .query("notificationIntents")
        .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
        .first());
    if (expired) {
      await ctx.scheduler.runAfter(
        0,
        internal.notificationEmails.purgeExpired,
        {},
      );
    }
    return null;
  },
});

/**
 * Deletes an email delivery with its attempts and, for a digest, its list of
 * notifications, within `budget` deletes. Returns the budget left.
 */
async function purgeDelivery(
  ctx: MutationCtx,
  deliveryId: Id<"notificationEmailDeliveries">,
  budget: number,
) {
  let remaining = budget;
  const attempts = await ctx.db
    .query("notificationEmailAttempts")
    .withIndex("by_deliveryId_and_attemptNumber", (q) =>
      q.eq("deliveryId", deliveryId),
    )
    .take(remaining);
  for (const attempt of attempts) {
    await ctx.db.delete(attempt._id);
  }
  remaining -= attempts.length;
  if (remaining <= 0) return 0;
  const items = await ctx.db
    .query("notificationDigestItems")
    .withIndex("by_deliveryId", (q) => q.eq("deliveryId", deliveryId))
    .take(remaining);
  for (const item of items) {
    await ctx.db.delete(item._id);
  }
  remaining -= items.length;
  if (remaining <= 0) return 0;
  await ctx.db.delete(deliveryId);
  return remaining - 1;
}

/** Deletes an intent and any email deliveries still kept for it within `budget` deletes. */
async function purgeIntent(
  ctx: MutationCtx,
  intentId: Id<"notificationIntents">,
  budget: number,
) {
  let remaining = budget;
  const deliveries = await ctx.db
    .query("notificationEmailDeliveries")
    .withIndex("by_intentId", (q) => q.eq("intentId", intentId))
    .take(remaining);
  for (const delivery of deliveries) {
    remaining = await purgeDelivery(ctx, delivery._id, remaining);
    if (remaining <= 0) return 0;
  }
  await ctx.db.delete(intentId);
  return remaining - 1;
}

/**
 * Retention: intents, email deliveries (instant and digest) and their
 * attempts are operational telemetry kept for 30 days, which is also how long
 * an idempotency key holds. In-app notifications are kept until their
 * recipient deletes them.
 */
export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - DELIVERY_RETENTION_MS;
    let budget = PURGE_DOCUMENT_BUDGET;
    const deliveries = await ctx.db
      .query("notificationEmailDeliveries")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(PURGE_BATCH);
    for (const delivery of deliveries) {
      budget = await purgeDelivery(ctx, delivery._id, budget);
      if (budget <= 0) break;
    }
    const intents =
      budget > 0
        ? await ctx.db
            .query("notificationIntents")
            .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
            .take(PURGE_BATCH)
        : [];
    for (const intent of intents) {
      budget = await purgeIntent(ctx, intent._id, budget);
      if (budget <= 0) break;
    }
    if (
      budget <= 0 ||
      deliveries.length === PURGE_BATCH ||
      intents.length === PURGE_BATCH
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.notificationEmails.purgeExpired,
        {},
      );
    }
    return null;
  },
});
