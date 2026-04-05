import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { auditLogChanges } from "./schema";
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
    activities: v.array(
      v.object({
        _id: v.id("auditLog"),
        userId: v.id("users"),
        userName: v.optional(v.string()),
        userEmail: v.optional(v.string()),
        userImage: v.optional(v.string()),
        action: v.string(),
        entityType: v.string(),
        entityId: v.string(),
        changes: v.optional(auditLogChanges),
        timestamp: v.number(),
      }),
    ),
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

    const limit = args.limit ?? 50;

    // Build query
    let auditQuery = ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    // Apply filters
    if (args.startDate) {
      auditQuery = auditQuery.filter((q) =>
        q.gte(q.field("timestamp"), args.startDate!),
      );
    }
    if (args.endDate) {
      auditQuery = auditQuery.filter((q) =>
        q.lte(q.field("timestamp"), args.endDate!),
      );
    }
    if (args.entityType) {
      auditQuery = auditQuery.filter((q) =>
        q.eq(q.field("entityType"), args.entityType!),
      );
    }

    // Order by timestamp descending (most recent first)
    const logs = await auditQuery.order("desc").take(limit);

    // Fetch user information for each log entry
    const activities = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        const userImage = user?.imageId
          ? (await ctx.storage.getUrl(user.imageId)) ?? undefined
          : undefined;

        return {
          _id: log._id,
          userId: log.userId,
          userName: user?.name || user?.username || undefined,
          userEmail: user?.email || undefined,
          userImage,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          changes: log.changes,
          timestamp: log.timestamp,
        };
      }),
    );

    // Simple pagination - if we got less than limit, we're done
    const isDone = activities.length < limit;

    return {
      activities,
      isDone,
      continueCursor: isDone
        ? undefined
        : activities[activities.length - 1]?._id,
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

    await ctx.db.insert("auditLog", {
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const notification = await ctx.db.get(args.notificationId);
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

    // Get notifications ordered by creation time (newest first)
    const notifications = await notificationQuery.order("desc").take(limit);

    // Get unread count
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_organization_and_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("read", false),
      )
      .collect();

    return {
      notifications,
      unreadCount: unreadNotifications.length,
    };
  },
});
