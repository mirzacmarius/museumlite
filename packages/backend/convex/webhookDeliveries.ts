import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import {
  attemptOutcome,
  claimStep,
  DELIVERY_RETENTION_MS,
  DELIVERY_SWEEP_GRACE_MS,
  type DeliveryStatus,
  deliveryStatus,
  finishedWithoutSending,
  isRetryableStatus,
  ledgerProgress,
  resultStep,
  retrySeriesPatch,
} from "./utils/deliveryLedger";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";
import {
  type EndpointIneligibility,
  endpointIneligibility,
  isSupportedWebhookEvent,
  MAX_WEBHOOKS_PER_ORGANIZATION,
  maxAttemptsFor,
  WEBHOOK_LAST_TRIGGERED_RESOLUTION_MS,
  WEBHOOK_TEST_EVENT,
} from "./utils/webhookDelivery";
import { type WebhookErrorCode, webhookError } from "./utils/webhookErrors";
import { emitWebhookEvent, recordWebhookEvent } from "./utils/webhookEvents";
import {
  type WebhookDeliveryErrorCode,
  webhookDeliveryErrorCode,
} from "./utils/webhookValidators";

const MANAGE_PERMISSION = "organization.manage_settings";

const deliverySummary = v.object({
  _id: v.id("webhookDeliveries"),
  _creationTime: v.number(),
  webhookId: v.id("webhooks"),
  webhookName: v.union(v.string(), v.null()),
  eventType: v.string(),
  status: deliveryStatus,
  attemptCount: v.number(),
  seriesAttempts: v.number(),
  maxAttempts: v.number(),
  inFlight: v.boolean(),
  nextAttemptAt: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  lastResponseStatus: v.optional(v.number()),
  lastErrorCode: v.optional(webhookDeliveryErrorCode),
  retryCount: v.number(),
  completedAt: v.optional(v.number()),
});

function toSummary(
  delivery: Doc<"webhookDeliveries">,
  webhookName: string | null,
) {
  return {
    _id: delivery._id,
    _creationTime: delivery._creationTime,
    webhookId: delivery.webhookId,
    webhookName,
    eventType: delivery.eventType,
    status: delivery.status,
    attemptCount: delivery.attemptCount,
    maxAttempts: delivery.maxAttempts,
    ...ledgerProgress(delivery),
    lastAttemptAt: delivery.lastAttemptAt,
    lastResponseStatus: delivery.lastResponseStatus,
    lastErrorCode: delivery.lastErrorCode,
    retryCount: delivery.retryCount,
    completedAt: delivery.completedAt,
  };
}

function deliveriesQuery(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  webhookId: Id<"webhooks"> | undefined,
  status: DeliveryStatus | undefined,
) {
  const table = ctx.db.query("webhookDeliveries");
  if (webhookId && status) {
    return table.withIndex("by_organizationId_and_webhookId_and_status", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("webhookId", webhookId)
        .eq("status", status),
    );
  }
  if (webhookId) {
    return table.withIndex("by_organizationId_and_webhookId", (q) =>
      q.eq("organizationId", organizationId).eq("webhookId", webhookId),
    );
  }
  if (status) {
    return table.withIndex("by_organizationId_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", status),
    );
  }
  return table.withIndex("by_organizationId", (q) =>
    q.eq("organizationId", organizationId),
  );
}

async function endpointName(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  webhookId: Id<"webhooks">,
) {
  const webhook = await ctx.db.get(webhookId);
  return webhook?.organizationId === organizationId ? webhook.name : null;
}

/** Newest first; optionally narrowed to one endpoint and/or one status. */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    webhookId: v.optional(v.id("webhooks")),
    status: v.optional(deliveryStatus),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(deliverySummary),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const result = await deliveriesQuery(
      ctx,
      args.organizationId,
      args.webhookId,
      args.status,
    )
      .order("desc")
      .paginate(args.paginationOpts);

    const webhookIds = [...new Set(result.page.map((d) => d.webhookId))];
    const names = new Map(
      await Promise.all(
        webhookIds.map(
          async (id) =>
            [id, await endpointName(ctx, args.organizationId, id)] as const,
        ),
      ),
    );
    return {
      ...result,
      page: result.page.map((delivery) =>
        toSummary(delivery, names.get(delivery.webhookId) ?? null),
      ),
    };
  },
});

const ATTEMPT_HISTORY_LIMIT = 50;

/** Delivery, captured payload and newest attempts; null outside the tenant. */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
    deliveryId: v.id("webhookDeliveries"),
  },
  returns: v.union(
    v.object({
      delivery: deliverySummary,
      event: v.object({
        eventId: v.string(),
        type: v.string(),
        payloadVersion: v.number(),
        body: v.string(),
      }),
      attempts: v.array(
        v.object({
          attemptNumber: v.number(),
          startedAt: v.number(),
          durationMs: v.number(),
          outcome: attemptOutcome,
          responseStatus: v.optional(v.number()),
          errorCode: v.optional(webhookDeliveryErrorCode),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.organizationId !== args.organizationId) {
      return null;
    }
    const [event, attempts, webhookName] = await Promise.all([
      ctx.db.get(delivery.eventId),
      ctx.db
        .query("webhookDeliveryAttempts")
        .withIndex("by_deliveryId_and_attemptNumber", (q) =>
          q.eq("deliveryId", delivery._id),
        )
        .order("desc")
        .take(ATTEMPT_HISTORY_LIMIT),
      endpointName(ctx, args.organizationId, delivery.webhookId),
    ]);
    if (!event) {
      return null;
    }
    return {
      delivery: toSummary(delivery, webhookName),
      event: {
        eventId: event.eventId,
        type: event.type,
        payloadVersion: event.payloadVersion,
        body: event.body,
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

const INELIGIBLE_ENDPOINT_ERRORS = {
  endpoint_deleted: ["WEBHOOK_NOT_FOUND", "Webhook endpoint not found"],
  endpoint_disabled: ["WEBHOOK_DISABLED", "Webhook endpoint is disabled"],
  endpoint_unsubscribed: [
    "WEBHOOK_NOT_SUBSCRIBED",
    "Webhook endpoint no longer subscribes to this event",
  ],
  endpoint_insecure: [
    "WEBHOOK_URL_INVALID",
    "Webhook URL must be a public HTTPS address",
  ],
} as const satisfies Record<
  EndpointIneligibility,
  readonly [WebhookErrorCode, string]
>;

/**
 * The claim-time endpoint checks, run up front for manual retries and test
 * sends so an administrator learns immediately why nothing can be queued.
 */
async function requireSendableWebhook(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  webhookId: Id<"webhooks">,
  eventType: string,
) {
  const webhook = await ctx.db.get(webhookId);
  const ineligibility = endpointIneligibility(
    webhook,
    organizationId,
    eventType,
  );
  if (ineligibility || !webhook) {
    const [code, message] =
      INELIGIBLE_ENDPOINT_ERRORS[ineligibility ?? "endpoint_deleted"];
    throw webhookError(code, message);
  }
  return webhook;
}

/**
 * Starts a new attempt series for a finished, unsuccessful delivery. The
 * delivery id and captured body are unchanged, so receivers can deduplicate.
 */
export const retry = mutation({
  args: {
    organizationId: v.id("organizations"),
    deliveryId: v.id("webhookDeliveries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);

    const delivery = await ctx.db.get(args.deliveryId);
    const event = delivery ? await ctx.db.get(delivery.eventId) : null;
    if (
      !delivery ||
      !event ||
      delivery.organizationId !== args.organizationId
    ) {
      throw webhookError("DELIVERY_NOT_FOUND", "Delivery not found");
    }
    if (!isRetryableStatus(delivery.status)) {
      throw webhookError(
        "DELIVERY_NOT_RETRYABLE",
        "Only failed or cancelled deliveries can be retried",
      );
    }
    await requireSendableWebhook(
      ctx,
      args.organizationId,
      delivery.webhookId,
      delivery.eventType,
    );

    await ctx.db.patch(
      delivery._id,
      retrySeriesPatch(
        delivery,
        userId,
        maxAttemptsFor(delivery.eventType),
        Date.now(),
      ),
    );
    await ctx.scheduler.runAfter(0, internal.webhooksActions.attemptDelivery, {
      deliveryId: delivery._id,
      attempt: delivery.attemptCount + 1,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "retried_webhook_delivery",
      entityType: "webhook",
      entityId: delivery.webhookId,
      changes: { deliveryId: delivery._id, eventType: delivery.eventType },
    });
    return null;
  },
});

/**
 * Sends a fixture event to one endpoint, regardless of its subscriptions, and
 * records it in the delivery log. Test sends get a single attempt.
 */
export const sendTest = mutation({
  args: {
    organizationId: v.id("organizations"),
    webhookId: v.id("webhooks"),
  },
  returns: v.id("webhookDeliveries"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requirePermission(ctx, args.organizationId, MANAGE_PERMISSION);
    const webhook = await requireSendableWebhook(
      ctx,
      args.organizationId,
      args.webhookId,
      WEBHOOK_TEST_EVENT,
    );
    const [deliveryId] = await recordWebhookEvent(ctx, {
      organizationId: args.organizationId,
      type: WEBHOOK_TEST_EVENT,
      data: { message: "This is a test webhook delivery from MuseumLite" },
      webhooks: [webhook],
    });
    if (!deliveryId) throw new Error("Test delivery was not recorded");
    return deliveryId;
  },
});

/** Schedules the first attempt of each new delivery of an event. */
export const dispatchEvent = internalMutation({
  args: { eventId: v.id("webhookEvents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_WEBHOOKS_PER_ORGANIZATION);
    for (const delivery of deliveries) {
      if (delivery.status === "pending" && delivery.attemptCount === 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.webhooksActions.attemptDelivery,
          { deliveryId: delivery._id, attempt: 1 },
        );
      }
    }
    return null;
  },
});

/**
 * Durably records an event handed over by a `webhooksActions.deliver` job
 * that was scheduled before durable deliveries were deployed.
 */
export const recordLegacyEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    event: v.string(),
    data: v.record(v.string(), v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (isSupportedWebhookEvent(args.event)) {
      await emitWebhookEvent(ctx, args.organizationId, args.event, args.data);
    }
    return null;
  },
});

const claimResult = v.union(
  v.object({ kind: v.literal("skip") }),
  v.object({
    kind: v.literal("send"),
    url: v.string(),
    secret: v.string(),
    body: v.string(),
    eventType: v.string(),
  }),
);

async function finishWithoutSending(
  ctx: MutationCtx,
  delivery: Doc<"webhookDeliveries">,
  status: "cancelled" | "failed_permanent" | "failed_transient",
  errorCode: WebhookDeliveryErrorCode,
) {
  await ctx.db.patch(delivery._id, {
    ...finishedWithoutSending(status, Date.now()),
    lastErrorCode: errorCode,
  });
  return { kind: "skip" as const };
}

/**
 * Claims attempt `attempt` of a pending delivery. Anything else (a finished
 * delivery, a duplicate or stale scheduled run) is a no-op. Revoked endpoints
 * end the delivery without sending.
 */
export const claimAttempt = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
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
      await ctx.db.insert("webhookDeliveryAttempts", {
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

    const [webhook, event] = await Promise.all([
      ctx.db.get(delivery.webhookId),
      ctx.db.get(delivery.eventId),
    ]);
    if (!event) {
      return await finishWithoutSending(
        ctx,
        delivery,
        "cancelled",
        "event_expired",
      );
    }
    const ineligibility = endpointIneligibility(
      webhook,
      delivery.organizationId,
      delivery.eventType,
    );
    if (ineligibility || !webhook) {
      return await finishWithoutSending(
        ctx,
        delivery,
        ineligibility === "endpoint_insecure"
          ? "failed_permanent"
          : "cancelled",
        ineligibility ?? "endpoint_deleted",
      );
    }

    await ctx.db.patch(delivery._id, step.patch);
    return {
      kind: "send" as const,
      url: webhook.url,
      secret: webhook.secret,
      body: event.body,
      eventType: delivery.eventType,
    };
  },
});

const SWEEP_BATCH = 100;
const PURGE_EVENT_BATCH = 20;
const PURGE_DOCUMENT_BUDGET = 400;

/**
 * Cron entry point. Reschedules pending deliveries whose attempt is overdue
 * (a lost scheduled run or an expired in-flight lease), then starts the
 * retention purge when events have aged out.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = await ctx.db
      .query("webhookDeliveries")
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
        internal.webhooksActions.attemptDelivery,
        { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
      );
    }

    const expired = await ctx.db
      .query("webhookEvents")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", now - DELIVERY_RETENTION_MS),
      )
      .first();
    if (expired) {
      await ctx.scheduler.runAfter(
        0,
        internal.webhookDeliveries.purgeExpired,
        {},
      );
    }
    return null;
  },
});

/** Deletes an event's deliveries and attempts within `budget` document deletes. */
async function purgeEvent(
  ctx: MutationCtx,
  eventId: Id<"webhookEvents">,
  budget: number,
) {
  let remaining = budget;
  const deliveries = await ctx.db
    .query("webhookDeliveries")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(remaining);
  for (const delivery of deliveries) {
    const attempts = await ctx.db
      .query("webhookDeliveryAttempts")
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
  await ctx.db.delete(eventId);
  return remaining - 1;
}

/**
 * Retention: delivery logs are operational telemetry, not institutional
 * records, and are kept for 30 days. Runs in bounded batches.
 */
export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const events = await ctx.db
      .query("webhookEvents")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", Date.now() - DELIVERY_RETENTION_MS),
      )
      .take(PURGE_EVENT_BATCH);
    let budget = PURGE_DOCUMENT_BUDGET;
    for (const event of events) {
      budget = await purgeEvent(ctx, event._id, budget);
      if (budget <= 0) break;
    }
    if (budget <= 0 || events.length === PURGE_EVENT_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.webhookDeliveries.purgeExpired,
        {},
      );
    }
    return null;
  },
});

/**
 * Stores the result of the attempt currently in flight and schedules the next
 * one with backoff. Results for any other attempt are ignored.
 */
export const recordAttemptResult = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    attempt: v.number(),
    startedAt: v.number(),
    durationMs: v.number(),
    outcome: attemptOutcome,
    responseStatus: v.optional(v.number()),
    errorCode: v.optional(webhookDeliveryErrorCode),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) {
      return null;
    }
    const now = Date.now();
    const step = resultStep(delivery, args, now);
    if (step.kind === "stale") {
      return null;
    }
    await ctx.db.insert("webhookDeliveryAttempts", {
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
    });
    if (step.kind === "retry") {
      await ctx.scheduler.runAt(
        step.nextAttemptAt,
        internal.webhooksActions.attemptDelivery,
        { deliveryId: delivery._id, attempt: delivery.attemptCount + 1 },
      );
    } else if (args.outcome === "succeeded") {
      const webhook = await ctx.db.get(delivery.webhookId);
      if (
        webhook &&
        now - (webhook.lastTriggeredAt ?? 0) >=
          WEBHOOK_LAST_TRIGGERED_RESOLUTION_MS
      ) {
        await ctx.db.patch(webhook._id, { lastTriggeredAt: now });
      }
    }
    return null;
  },
});
