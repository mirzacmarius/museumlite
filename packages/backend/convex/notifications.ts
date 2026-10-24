import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { deliveryStatus, ledgerProgress } from "./utils/deliveryLedger";
import { mutation } from "./utils/mutationBuilders";
import {
  isValidDigestSchedule,
  moveWaitingDigests,
  nextDigestOf,
} from "./utils/notificationDigests";
import { notificationEmailChannel } from "./utils/notificationEmailChannel";
import { notificationError } from "./utils/notificationErrors";
import {
  categoryChannelMatrix,
  channelPolicy,
  emailSchedule,
  emailScheduleChoice,
  preferenceFieldsFor,
  storedPreferences,
} from "./utils/notificationPreferences";
import {
  categoryOfType,
  notificationCategory,
} from "./utils/notificationTypes";
import {
  digestCadence,
  notificationEmailErrorCode,
} from "./utils/notificationValidators";
import { getCurrentUserOrganization } from "./utils/permissions";

// ============================================
// Enhanced Notification Queries
// ============================================

const emailOutcome = v.object({
  deliveryId: v.id("notificationEmailDeliveries"),
  status: deliveryStatus,
  attemptCount: v.number(),
  maxAttempts: v.number(),
  seriesAttempts: v.number(),
  inFlight: v.boolean(),
  nextAttemptAt: v.optional(v.number()),
  lastAttemptAt: v.optional(v.number()),
  lastResponseStatus: v.optional(v.number()),
  lastErrorCode: v.optional(notificationEmailErrorCode),
  completedAt: v.optional(v.number()),
  /** Set when the notification is emailed in a digest rather than on its own. */
  digest: v.optional(
    v.object({
      cadence: digestCadence,
      scheduledFor: v.number(),
      /** Why the digest's latest attempt left this notification out. */
      excludedReason: v.optional(notificationEmailErrorCode),
    }),
  ),
});

function outcomeOf(delivery: Doc<"notificationEmailDeliveries">) {
  return {
    deliveryId: delivery._id,
    status: delivery.status,
    attemptCount: delivery.attemptCount,
    maxAttempts: delivery.maxAttempts,
    ...ledgerProgress(delivery),
    lastAttemptAt: delivery.lastAttemptAt,
    lastResponseStatus: delivery.lastResponseStatus,
    lastErrorCode: delivery.lastErrorCode,
    completedAt: delivery.completedAt,
  };
}

/** The email that carries a notification: its own, or the digest it is in. */
async function emailOutcomeOf(
  ctx: QueryCtx,
  notificationId: Id<"notifications">,
): Promise<Infer<typeof emailOutcome> | null> {
  const delivery = await ctx.db
    .query("notificationEmailDeliveries")
    .withIndex("by_notificationId", (q) =>
      q.eq("notificationId", notificationId),
    )
    .first();
  if (delivery) return outcomeOf(delivery);
  const item = await ctx.db
    .query("notificationDigestItems")
    .withIndex("by_notificationId", (q) =>
      q.eq("notificationId", notificationId),
    )
    .first();
  const digest = item ? await ctx.db.get(item.deliveryId) : null;
  if (!item || digest?.kind !== "digest") return null;
  return {
    ...outcomeOf(digest),
    digest: {
      cadence: digest.cadence,
      scheduledFor: digest.scheduledFor,
      excludedReason: item.excludedReason,
    },
  };
}

/**
 * The caller's notifications in one organization, newest first, each with
 * its category and the outcome of its email when one was sent.
 */
export const getNotificationCenter = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    notifications: v.array(
      v.object({
        _id: v.id("notifications"),
        type: v.string(),
        title: v.string(),
        message: v.string(),
        read: v.boolean(),
        relatedEntityType: v.optional(v.string()),
        relatedEntityId: v.optional(v.string()),
        createdAt: v.number(),
        category: notificationCategory,
        email: v.union(emailOutcome, v.null()),
      }),
    ),
    unreadCount: v.number(),
    unreadByCategory: v.object({
      approvals: v.number(),
      reminders: v.number(),
      alerts: v.number(),
      assignments: v.number(),
      system: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit ?? 100;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_createdAt", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit);

    const categorizedNotifications = await Promise.all(
      notifications.map(async (n) => ({
        _id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
        createdAt: n.createdAt,
        category: categoryOfType(n.type),
        email: await emailOutcomeOf(ctx, n._id),
      })),
    );

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("read", false),
      )
      .collect();

    const unreadByCategory = {
      approvals: 0,
      reminders: 0,
      alerts: 0,
      assignments: 0,
      system: 0,
    };

    for (const n of unreadNotifications) {
      unreadByCategory[categoryOfType(n.type)]++;
    }

    return {
      notifications: categorizedNotifications,
      unreadCount: unreadNotifications.length,
      unreadByCategory,
    };
  },
});

/** The bell shows up to nine unread notifications, and 9+ beyond. */
const BELL_UNREAD_LIMIT = 10;

/**
 * Counts the viewer's unread notifications for the bell, up to 10. The bell
 * is on every page, so it never reads more notifications than it can show.
 */
export const getUnreadCount = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("read", false),
      )
      .take(BELL_UNREAD_LIMIT);

    return unreadNotifications.length;
  },
});

/**
 * Get notifications by category
 */
export const getNotificationsByCategory = query({
  args: {
    organizationId: v.id("organizations"),
    category: v.union(
      v.literal("approvals"),
      v.literal("reminders"),
      v.literal("alerts"),
      v.literal("assignments"),
      v.literal("system"),
    ),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      type: v.string(),
      title: v.string(),
      message: v.string(),
      read: v.boolean(),
      relatedEntityType: v.optional(v.string()),
      relatedEntityId: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit ?? 50;

    let notificationsQuery = ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_createdAt", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      );

    if (args.unreadOnly) {
      notificationsQuery = notificationsQuery.filter((q) =>
        q.eq(q.field("read"), false),
      );
    }

    const notifications = await notificationsQuery
      .order("desc")
      .take(limit * 2);

    // Filter by category types
    const filtered = notifications
      .filter((n) => categoryOfType(n.type) === args.category)
      .slice(0, limit);

    return filtered.map((n) => ({
      _id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      relatedEntityType: n.relatedEntityType,
      relatedEntityId: n.relatedEntityId,
      createdAt: n.createdAt,
    }));
  },
});

// ============================================
// Notification Actions
// ============================================

/**
 * Mark notification as unread
 */
export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, notification] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.notificationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Unauthorized");
    }

    if (notification.read) {
      return null;
    }

    await ctx.db.patch(args.notificationId, { read: true });

    return null;
  },
});

export const markAllRead = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("read", false),
      )
      .collect();

    await Promise.all(
      unreadNotifications.map((notification) =>
        ctx.db.patch(notification._id, { read: true }),
      ),
    );

    return null;
  },
});

export const markUnread = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, notification] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.notificationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.notificationId, { read: false });

    return null;
  },
});

/**
 * Delete a notification
 */
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, notification] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.notificationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.notificationId);

    return null;
  },
});

/**
 * Bulk mark notifications as read
 */
export const bulkMarkRead = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const notifications = await Promise.all(
      args.notificationIds.map((notificationId) => ctx.db.get(notificationId)),
    );
    const readableNotificationIds = notifications.flatMap((notification) =>
      notification?.userId === userId ? [notification._id] : [],
    );

    await Promise.all(
      readableNotificationIds.map((notificationId) =>
        ctx.db.patch(notificationId, { read: true }),
      ),
    );

    return readableNotificationIds.length;
  },
});

/**
 * Bulk delete notifications
 */
export const bulkDelete = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deleteResults = await Promise.all(
      Array.from(args.notificationIds).map(async (notificationId) => {
        const notification = await ctx.db.get(notificationId);
        if (notification && notification.userId === userId) {
          await ctx.db.delete(notificationId);
          return 1;
        }
        return 0;
      }),
    );

    return deleteResults.reduce<number>((total, deleted) => total + deleted, 0);
  },
});

/**
 * Delete all read notifications older than specified days
 */
export const cleanupOldNotifications = mutation({
  args: {
    organizationId: v.id("organizations"),
    olderThanDays: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const days = args.olderThanDays ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const oldNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("read", true),
      )
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .collect();

    await Promise.all(
      Array.from(oldNotifications).map(async (notification) => {
        await ctx.db.delete(notification._id);
      }),
    );

    return oldNotifications.length;
  },
});

// ============================================
// Notification Preferences
// ============================================

/**
 * The caller's category matrix for one organization and what their email
 * channel can actually deliver: whether this deployment sends notification
 * email, to which address, when (as notifications happen or in a digest),
 * and the next digest waiting to be sent.
 */
export const getPreferences = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      categories: categoryChannelMatrix,
      email: v.object({
        channel: v.union(
          v.literal("provider"),
          v.literal("fixture"),
          v.literal("unavailable"),
        ),
        address: v.union(v.string(), v.null()),
        schedule: emailSchedule,
        /** A digest chosen before digests had a time; it sends nothing until one is saved. */
        digestUnscheduled: v.boolean(),
        nextDigest: v.union(
          v.object({ scheduledFor: v.number(), notificationCount: v.number() }),
          v.null(),
        ),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const membership = await getCurrentUserOrganization(
      ctx,
      args.organizationId,
    );
    if (!membership) {
      return null;
    }
    const [user, preferences, nextDigest] = await Promise.all([
      ctx.db.get(userId),
      storedPreferences(ctx, userId, args.organizationId),
      nextDigestOf(ctx, { organizationId: args.organizationId, userId }),
    ]);
    const policy = channelPolicy(preferences);
    const choice = emailScheduleChoice(preferences);
    return {
      categories: policy.categories,
      email: {
        channel: notificationEmailChannel().kind,
        address: user?.email ?? null,
        schedule: choice.schedule,
        digestUnscheduled: choice.unscheduled && policy.emailCadence !== null,
        nextDigest,
      },
    };
  },
});

/**
 * Replaces the caller's choices for one organization: which categories
 * notify them, which of those are also emailed, and whether that email is
 * sent as notifications happen (the default) or as a daily or weekly digest
 * at a local time. Digests already waiting move to the new time.
 */
export const updatePreferences = mutation({
  args: {
    organizationId: v.id("organizations"),
    categories: categoryChannelMatrix,
    emailSchedule: v.optional(emailSchedule),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const membership = await getCurrentUserOrganization(
      ctx,
      args.organizationId,
    );
    if (!membership) {
      throw notificationError("NOT_ORGANIZATION_MEMBER");
    }
    const schedule = args.emailSchedule ?? { cadence: "instant" as const };
    if (schedule.cadence !== "instant" && !isValidDigestSchedule(schedule)) {
      throw notificationError("DIGEST_SCHEDULE_INVALID");
    }
    const emailRequested = Object.values(args.categories).some(
      (choice) => choice.enabled && choice.email,
    );
    if (emailRequested) {
      if (notificationEmailChannel().kind === "unavailable") {
        throw notificationError("EMAIL_CHANNEL_UNAVAILABLE");
      }
      const user = await ctx.db.get(userId);
      if (!user?.email) {
        throw notificationError("EMAIL_ADDRESS_MISSING");
      }
    }

    const now = Date.now();
    const fields = {
      ...preferenceFieldsFor(args.categories, schedule),
      updatedAt: now,
    };
    const existing = await storedPreferences(ctx, userId, args.organizationId);
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId,
        organizationId: args.organizationId,
        ...fields,
      });
    }
    await moveWaitingDigests(
      ctx,
      { organizationId: args.organizationId, userId },
      emailRequested && schedule.cadence !== "instant" ? schedule : null,
      now,
    );
    return null;
  },
});
