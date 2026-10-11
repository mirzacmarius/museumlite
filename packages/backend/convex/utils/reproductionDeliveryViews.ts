import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  attemptOutcome,
  deliveryStatus,
  ledgerProgress,
} from "./deliveryLedger";
import {
  downloadOutcome,
  reproductionDeliveryErrorCode,
} from "./reproductionRequestValidators";

const DELIVERY_LIMIT = 20;
const ATTEMPT_LIMIT = 50;

export const deliveryItem = v.object({
  _id: v.id("reproductionDeliveries"),
  _creationTime: v.number(),
  recipientEmail: v.string(),
  status: deliveryStatus,
  attemptCount: v.number(),
  maxAttempts: v.number(),
  seriesAttempts: v.number(),
  inFlight: v.boolean(),
  nextAttemptAt: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  lastResponseStatus: v.optional(v.number()),
  lastErrorCode: v.optional(reproductionDeliveryErrorCode),
  retryCount: v.number(),
  completedAt: v.optional(v.number()),
  attempts: v.array(
    v.object({
      attemptNumber: v.number(),
      startedAt: v.number(),
      durationMs: v.number(),
      outcome: attemptOutcome,
      responseStatus: v.optional(v.number()),
      errorCode: v.optional(reproductionDeliveryErrorCode),
    }),
  ),
});

/** A request's deliveries, newest first, with their newest attempts. */
export async function deliveriesView(
  ctx: QueryCtx,
  request: Doc<"reproductionRequests">,
) {
  const deliveries = await ctx.db
    .query("reproductionDeliveries")
    .withIndex("by_requestId", (q) => q.eq("requestId", request._id))
    .order("desc")
    .take(DELIVERY_LIMIT);
  return await Promise.all(
    deliveries.map(async (delivery) => {
      const attempts = await ctx.db
        .query("reproductionDeliveryAttempts")
        .withIndex("by_deliveryId_and_attemptNumber", (q) =>
          q.eq("deliveryId", delivery._id),
        )
        .order("desc")
        .take(ATTEMPT_LIMIT);
      return {
        _id: delivery._id,
        _creationTime: delivery._creationTime,
        recipientEmail: delivery.recipientEmail,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        maxAttempts: delivery.maxAttempts,
        ...ledgerProgress(delivery),
        lastAttemptAt: delivery.lastAttemptAt,
        lastResponseStatus: delivery.lastResponseStatus,
        lastErrorCode: delivery.lastErrorCode,
        retryCount: delivery.retryCount,
        completedAt: delivery.completedAt,
        attempts: attempts.map((attempt) => ({
          attemptNumber: attempt.attemptNumber,
          startedAt: attempt.startedAt,
          durationMs: attempt.durationMs,
          outcome: attempt.outcome,
          responseStatus: attempt.responseStatus,
          errorCode: attempt.errorCode,
        })),
      };
    }),
  );
}

const DOWNLOAD_LIMIT = 100;

export const downloadItem = v.object({
  _id: v.id("reproductionDownloads"),
  at: v.number(),
  outcome: downloadOutcome,
  byteSize: v.optional(v.number()),
});

/** The request's newest use records. */
export async function downloadsView(
  ctx: QueryCtx,
  request: Doc<"reproductionRequests">,
) {
  const downloads = await ctx.db
    .query("reproductionDownloads")
    .withIndex("by_requestId_and_at", (q) => q.eq("requestId", request._id))
    .order("desc")
    .take(DOWNLOAD_LIMIT);
  return downloads.map((download) => ({
    _id: download._id,
    at: download.at,
    outcome: download.outcome,
    byteSize: download.byteSize,
  }));
}
