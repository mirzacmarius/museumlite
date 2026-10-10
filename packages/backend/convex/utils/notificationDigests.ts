import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLocalTime, isTimeZone, nextScheduledRun } from "./calendarSchedule";
import { DELIVERY_MAX_ATTEMPTS, newDeliveryLedger } from "./deliveryLedger";
import type { DigestSchedule } from "./notificationPreferences";

/** Notifications one digest email lists; more start another digest for the same time. */
export const DIGEST_ITEM_LIMIT = 100;
/** Waiting digests of one recipient that a schedule change moves. */
const WAITING_DIGEST_LIMIT = 20;

export type DigestDelivery = Extract<
  Doc<"notificationEmailDeliveries">,
  { kind: "digest" }
>;

export function isValidDigestSchedule(schedule: DigestSchedule) {
  return (
    isLocalTime(schedule.time) &&
    isTimeZone(schedule.timezone) &&
    (schedule.cadence === "daily" ||
      (Number.isInteger(schedule.day) &&
        schedule.day >= 0 &&
        schedule.day <= 6))
  );
}

/** The first digest time strictly after `after`, in the schedule's time zone. */
export function nextDigestTime(schedule: DigestSchedule, after: number) {
  const next = nextScheduledRun(
    {
      schedule: schedule.cadence,
      scheduledDay: schedule.cadence === "weekly" ? schedule.day : undefined,
      scheduledTime: schedule.time,
      timezone: schedule.timezone,
    },
    after,
  );
  if (next === undefined) throw new Error("Digest schedules always recur");
  return next;
}

/** A digest whose first attempt has not started, so it still collects notifications. */
function isWaiting(
  delivery: Doc<"notificationEmailDeliveries">,
): delivery is DigestDelivery {
  return (
    delivery.kind === "digest" &&
    delivery.status === "pending" &&
    delivery.attemptCount === 0
  );
}

/**
 * Adds a notification to the recipient's digest for their next digest time,
 * starting that digest (and scheduling its first attempt) when none is
 * waiting there with room left.
 */
export async function addToDigest(
  ctx: MutationCtx,
  item: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    notificationId: Id<"notifications">;
  },
  schedule: DigestSchedule,
  now: number,
) {
  const scheduledFor = nextDigestTime(schedule, now);
  let digest: {
    _id: Id<"notificationEmailDeliveries">;
    itemCount: number;
  } | null = null;
  for await (const delivery of ctx.db
    .query("notificationEmailDeliveries")
    .withIndex("by_userId_and_organizationId_and_scheduledFor", (q) =>
      q
        .eq("userId", item.userId)
        .eq("organizationId", item.organizationId)
        .eq("scheduledFor", scheduledFor),
    )) {
    if (isWaiting(delivery) && delivery.itemCount < DIGEST_ITEM_LIMIT) {
      digest = delivery;
      break;
    }
  }
  if (!digest) {
    const deliveryId = await ctx.db.insert("notificationEmailDeliveries", {
      kind: "digest",
      organizationId: item.organizationId,
      userId: item.userId,
      cadence: schedule.cadence,
      scheduledFor,
      itemCount: 0,
      ...newDeliveryLedger(DELIVERY_MAX_ATTEMPTS, scheduledFor),
    });
    await ctx.scheduler.runAt(
      scheduledFor,
      internal.notificationEmailsActions.attemptDelivery,
      { deliveryId, attempt: 1 },
    );
    digest = { _id: deliveryId, itemCount: 0 };
  }
  await ctx.db.insert("notificationDigestItems", {
    organizationId: item.organizationId,
    deliveryId: digest._id,
    notificationId: item.notificationId,
  });
  await ctx.db.patch(digest._id, { itemCount: digest.itemCount + 1 });
}

/**
 * After a recipient changes their email timing, their waiting digests move to
 * the next time of the new schedule, or are due now when they no longer want
 * a digest. A run scheduled for the old time finds the digest not yet due.
 */
export async function moveWaitingDigests(
  ctx: MutationCtx,
  recipient: { organizationId: Id<"organizations">; userId: Id<"users"> },
  schedule: DigestSchedule | null,
  now: number,
) {
  const dueAt = schedule ? nextDigestTime(schedule, now) : now;
  const upcoming = await ctx.db
    .query("notificationEmailDeliveries")
    .withIndex("by_userId_and_organizationId_and_scheduledFor", (q) =>
      q
        .eq("userId", recipient.userId)
        .eq("organizationId", recipient.organizationId)
        .gt("scheduledFor", now),
    )
    .take(WAITING_DIGEST_LIMIT);
  for (const delivery of upcoming) {
    if (!isWaiting(delivery) || delivery.scheduledFor === dueAt) continue;
    await ctx.db.patch(delivery._id, {
      scheduledFor: dueAt,
      nextAttemptAt: dueAt,
      cadence: schedule?.cadence ?? delivery.cadence,
    });
    await ctx.scheduler.runAt(
      dueAt,
      internal.notificationEmailsActions.attemptDelivery,
      { deliveryId: delivery._id, attempt: 1 },
    );
  }
}

/** The recipient's latest digest that has not been sent yet, with its size. */
export async function nextDigestOf(
  ctx: QueryCtx,
  recipient: { organizationId: Id<"organizations">; userId: Id<"users"> },
) {
  const latest = await ctx.db
    .query("notificationEmailDeliveries")
    .withIndex("by_userId_and_organizationId_and_scheduledFor", (q) =>
      q
        .eq("userId", recipient.userId)
        .eq("organizationId", recipient.organizationId)
        .gt("scheduledFor", 0),
    )
    .order("desc")
    .take(WAITING_DIGEST_LIMIT);
  const waiting = latest.filter(isWaiting);
  const [next] = waiting;
  if (!next) return null;
  return {
    scheduledFor: next.scheduledFor,
    notificationCount: waiting
      .filter((digest) => digest.scheduledFor === next.scheduledFor)
      .reduce((total, digest) => total + digest.itemCount, 0),
  };
}
