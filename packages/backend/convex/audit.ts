import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { auditEntryValidator, readHistoryPage } from "./auditLog";
import { auditLogChanges } from "./schema";
import { captureAuditEvidence } from "./utils/auditEvidence";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

/**
 * Get organization activity logs with pagination and filters
 */
export const listOrganizationActivity = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    activities: v.array(auditEntryValidator),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission - users need to be able to view organization activity
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.view_analytics",
    );

    const result = await readHistoryPage(
      ctx,
      {
        organizationId: args.organizationId,
        entityType: args.entityType,
        fromDate: args.startDate,
        toDate: args.endDate,
      },
      { numItems: args.limit ?? 50, cursor: args.cursor ?? null },
      "organization.view_analytics",
    );
    return {
      activities: result.entries,
      isDone: result.isDone,
      continueCursor: result.nextCursor,
    };
  },
});

/**
 * Internal: Create audit log entry (can be called from other mutations)
 */
export const logAction = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(auditLogChanges),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = args.userId || (await getAuthUserId(ctx));
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const evidence = await captureAuditEvidence(ctx, { ...args, userId });
    await ctx.db.insert("auditLog", {
      ...evidence,
      organizationId: args.organizationId,
      userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      changes: args.changes,
      timestamp: Date.now(),
    });

    return null;
  },
});

/**
 * Internal: Create a notification (can be called from other mutations)
 */
export const createNotificationInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      organizationId: args.organizationId,
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      read: false,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

/**
 * Create a user notification (public API)
 * Users can only create notifications for themselves.
 * For cross-user notifications, use createNotificationInternal from server-side code.
 */
export const createNotification = mutation({
  args: {
    organizationId: v.id("organizations"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    const notificationId = await ctx.db.insert("notifications", {
      organizationId: args.organizationId,
      userId: currentUserId,
      type: args.type,
      title: args.title,
      message: args.message,
      read: false,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

/**
 * Mark a notification as read
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

    // Only the notification owner can mark it as read
    if (notification.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.notificationId, {
      read: true,
    });

    return null;
  },
});

/**
 * Mark all notifications as read for a user in an organization
 */
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

    // Get all unread notifications for this user in this organization
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("read", false),
      )
      .collect();

    // Mark all as read
    await Promise.all(
      notifications.map((notification) =>
        ctx.db.patch(notification._id, { read: true }),
      ),
    );

    return null;
  },
});

/**
 * Get user notifications with pagination
 */
export const listNotifications = query({
  args: {
    organizationId: v.id("organizations"),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    notifications: v.array(
      v.object({
        _id: v.id("notifications"),
        _creationTime: v.number(),
        organizationId: v.id("organizations"),
        userId: v.id("users"),
        type: v.string(),
        title: v.string(),
        message: v.string(),
        read: v.boolean(),
        relatedEntityType: v.optional(v.string()),
        relatedEntityId: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
    unreadCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit ?? 50;

    // Build query based on read status
    let notificationQuery = ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_createdAt", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      );

    // Filter by read status if specified
    if (args.unreadOnly === true) {
      notificationQuery = notificationQuery.filter((q) =>
        q.eq(q.field("read"), false),
      );
    }

    const [notifications, unreadNotifications] = await Promise.all([
      notificationQuery.order("desc").take(limit),
      ctx.db
        .query("notifications")
        .withIndex("by_user_and_organization_and_read", (q) =>
          q
            .eq("userId", userId)
            .eq("organizationId", args.organizationId)
            .eq("read", false),
        )
        .collect(),
    ]);

    return {
      notifications,
      unreadCount: unreadNotifications.length,
    };
  },
});

export const activityPage = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(auditEntryValidator),
  handler: async (ctx, args) => {
    const result = await readHistoryPage(
      ctx,
      {
        organizationId: args.organizationId,
        entityType: args.entityType,
        fromDate: args.startDate,
        toDate: args.endDate,
      },
      args.paginationOpts,
      "organization.view_analytics",
    );
    return {
      page: result.entries,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      splitCursor: result.splitCursor,
      pageStatus: result.pageStatus,
    };
  },
});
