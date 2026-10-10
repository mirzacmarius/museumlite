import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, query } from "./_generated/server";
import { emailLocaleOf, emailLocaleValidator } from "./userPreferences";
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
import { emailCadence, recipientAccess } from "./utils/notificationDispatch";
import { notificationEmailChannel } from "./utils/notificationEmailChannel";
import {
  type NotificationErrorCode,
  notificationError,
} from "./utils/notificationErrors";
import { notificationEntityHref } from "./utils/notificationLinks";
import {
  channelPolicy,
  storedPreferences,
} from "./utils/notificationPreferences";
import {
  notificationCategory,
  readPermissionForEntity,
} from "./utils/notificationTypes";
import {
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
        notificationId: v.id("notifications"),
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
        notificationId: delivery.notificationId,
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
  "http_error" | "timeout" | "network_error" | "attempt_lost" | "event_expired"
>;

/**
 * Why the recipient may not be emailed this intent now, or null when they
 * may. Checked again before every attempt and every retry, because time
 * passes between the event and the send.
 */
async function emailIneligibility(
  ctx: MutationCtx,
  delivery: Doc<"notificationEmailDeliveries">,
  intent: Doc<"notificationIntents">,
): Promise<Ineligibility | null> {
  const readPermission =
    intent.relatedEntityType === undefined
      ? null
      : readPermissionForEntity(intent.relatedEntityType);
  if (readPermission === undefined) return "access_revoked";
  const recipient = await recipientAccess(ctx, delivery.organizationId).check(
    delivery.userId,
    readPermission,
  );
  if (recipient.kind === "not_member") return "recipient_removed";
  if (recipient.kind === "no_access") return "access_revoked";
  const policy = channelPolicy(
    await storedPreferences(ctx, delivery.userId, delivery.organizationId),
  );
  if (emailCadence(policy, intent.category, intent.type) !== "instant") {
    return "email_disabled";
  }
  if (!recipient.user.email) return "address_missing";
  if (notificationEmailChannel().kind === "unavailable") {
    return "channel_unavailable";
  }
  return null;
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
    content: v.object({
      organizationName: v.string(),
      category: notificationCategory,
      title: v.string(),
      message: v.string(),
      actionPath: v.string(),
      details: v.optional(notificationEmailDetails),
    }),
  }),
);

/**
 * Claims attempt `attempt` of a pending email delivery and returns what to
 * send. Stale or duplicate runs are no-ops; a recipient who may no longer be
 * emailed cancels the delivery without sending.
 */
export const claimAttempt = internalMutation({
  args: {
    deliveryId: v.id("notificationEmailDeliveries"),
    attempt: v.number(),
  },
  returns: claimResult,
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) {
      return { kind: "skip" as const };
    }
    const step = claimStep(delivery, args.attempt, Date.now());
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
    const [intent, organization, user] = await Promise.all([
      ctx.db.get(delivery.intentId),
      ctx.db.get(delivery.organizationId),
      ctx.db.get(delivery.userId),
    ]);
    if (!intent || !organization) {
      return await finishWithoutSending(
        ctx,
        delivery,
        "cancelled",
        "event_expired",
      );
    }
    const ineligibility = await emailIneligibility(ctx, delivery, intent);
    if (ineligibility || !user?.email) {
      return await finishWithoutSending(
        ctx,
        delivery,
        "cancelled",
        ineligibility ?? "address_missing",
      );
    }

    await ctx.db.patch(delivery._id, step.patch);
    return {
      kind: "send" as const,
      to: user.email,
      locale: await emailLocaleOf(ctx, delivery.userId),
      idempotencyKey: `${delivery._id}:${delivery.seriesStartAttempt}`,
      content: {
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
  recipient_removed: "NOT_ORGANIZATION_MEMBER",
  access_revoked: "NOTIFICATION_ACCESS_REVOKED",
  email_disabled: "EMAIL_OFF_FOR_CATEGORY",
  address_missing: "EMAIL_ADDRESS_MISSING",
  channel_unavailable: "EMAIL_CHANNEL_UNAVAILABLE",
};

/**
 * The recipient starts a new attempt series for their own failed or cancelled
 * email. Its content is the captured intent, so the message is unchanged.
 */
export const retry = mutation({
  args: { deliveryId: v.id("notificationEmailDeliveries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const delivery = await ctx.db.get(args.deliveryId);
    const intent = delivery ? await ctx.db.get(delivery.intentId) : null;
    if (!delivery || !intent || delivery.userId !== userId) {
      throw notificationError("EMAIL_DELIVERY_NOT_FOUND");
    }
    if (!isRetryableStatus(delivery.status)) {
      throw notificationError("EMAIL_DELIVERY_NOT_RETRYABLE");
    }
    const ineligibility = await emailIneligibility(ctx, delivery, intent);
    if (ineligibility) {
      throw notificationError(RETRY_BLOCKED[ineligibility]);
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
const PURGE_INTENT_BATCH = 20;
const PURGE_DOCUMENT_BUDGET = 400;

/**
 * Cron entry point. Reschedules pending emails whose attempt is overdue (a
 * lost scheduled run or an expired in-flight lease), then starts the
 * retention purge when intents have aged out.
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

    const expired = await ctx.db
      .query("notificationIntents")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", now - DELIVERY_RETENTION_MS),
      )
      .first();
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

/** Deletes an intent's email deliveries and attempts within `budget` deletes. */
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
    const attempts = await ctx.db
      .query("notificationEmailAttempts")
      .withIndex("by_deliveryId_and_attemptNumber", (q) =>
        q.eq("deliveryId", delivery._id),
      )
      .take(remaining);
    for (const attempt of attempts) {
      await ctx.db.delete(attempt._id);
    }
    remaining -= attempts.length;
    if (remaining <= 0) return 0;
    await ctx.db.delete(delivery._id);
    remaining -= 1;
    if (remaining <= 0) return 0;
  }
  await ctx.db.delete(intentId);
  return remaining - 1;
}

/**
 * Retention: intents and their email logs are operational telemetry kept for
 * 30 days, which is also how long an idempotency key holds. In-app
 * notifications are kept until their recipient deletes them.
 */
export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const intents = await ctx.db
      .query("notificationIntents")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", Date.now() - DELIVERY_RETENTION_MS),
      )
      .take(PURGE_INTENT_BATCH);
    let budget = PURGE_DOCUMENT_BUDGET;
    for (const intent of intents) {
      budget = await purgeIntent(ctx, intent._id, budget);
      if (budget <= 0) break;
    }
    if (budget <= 0 || intents.length === PURGE_INTENT_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.notificationEmails.purgeExpired,
        {},
      );
    }
    return null;
  },
});
