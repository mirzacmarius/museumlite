import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getUserIdsWithPermission } from "./utils/permissions";

// ============================================
// Notification Type Constants
// ============================================

export const NOTIFICATION_TYPES = {
  // Workflow approvals
  LOAN_PENDING_APPROVAL: "loan_pending_approval",
  LOAN_APPROVED: "loan_approved",
  LOAN_REJECTED: "loan_rejected",
  ACCESSION_PENDING_APPROVAL: "accession_pending_approval",
  ACCESSION_APPROVED: "accession_approved",
  DEACCESSION_PENDING_APPROVAL: "deaccession_pending_approval",
  DEACCESSION_APPROVED: "deaccession_approved",
  EXHIBITION_PENDING_APPROVAL: "exhibition_pending_approval",
  CONSERVATION_PENDING_APPROVAL: "conservation_pending_approval",

  // Due dates and reminders
  LOAN_DUE_SOON: "loan_due_soon",
  LOAN_OVERDUE: "loan_overdue",
  INSURANCE_EXPIRING: "insurance_expiring",
  LICENSE_EXPIRING: "license_expiring",
  ASSESSMENT_DUE: "assessment_due",

  // Alerts
  CONDITION_ALERT: "condition_alert",
  ENVIRONMENTAL_ALERT: "environmental_alert",
  CAPACITY_ALERT: "capacity_alert",

  // Assignments
  TASK_ASSIGNED: "task_assigned",
  TASK_COMPLETED: "task_completed",
  MOVE_REQUEST_CREATED: "move_request_created",
  MOVE_REQUEST_APPROVED: "move_request_approved",
  COMMENT_MENTION: "comment_mention",

  // System
  BATCH_JOB_COMPLETED: "batch_job_completed",
  REPORT_READY: "report_ready",
  SYSTEM_ANNOUNCEMENT: "system_announcement",
} as const;

export const NOTIFICATION_CATEGORIES = {
  approvals: [
    "loan_pending_approval",
    "loan_approved",
    "loan_rejected",
    "accession_pending_approval",
    "accession_approved",
    "deaccession_pending_approval",
    "deaccession_approved",
    "exhibition_pending_approval",
    "conservation_pending_approval",
    "move_request_created",
    "move_request_approved",
  ],
  reminders: [
    "loan_due_soon",
    "loan_overdue",
    "insurance_expiring",
    "license_expiring",
    "assessment_due",
  ],
  alerts: ["condition_alert", "environmental_alert", "capacity_alert"],
  assignments: ["task_assigned", "task_completed", "comment_mention"],
  system: ["batch_job_completed", "report_ready", "system_announcement"],
};

const NOTIFICATION_TYPE_TO_CATEGORY = new Map<string, string>(
  Object.entries(NOTIFICATION_CATEGORIES).flatMap(([category, types]) =>
    types.map((type) => [type, category]),
  ),
);

// ============================================
// Enhanced Notification Queries
// ============================================

/**
 * Get notification center data with categories
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
        category: v.string(),
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

    const categorizedNotifications = notifications.map((n) => ({
      _id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      relatedEntityType: n.relatedEntityType,
      relatedEntityId: n.relatedEntityId,
      createdAt: n.createdAt,
      category: getCategoryForType(n.type),
    }));

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
      const category = getCategoryForType(n.type);
      if (category in unreadByCategory) {
        unreadByCategory[category as keyof typeof unreadByCategory]++;
      }
    }

    return {
      notifications: categorizedNotifications,
      unreadCount: unreadNotifications.length,
      unreadByCategory,
    };
  },
});

/**
 * Get unread notification count (lightweight)
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
      .collect();

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

    const categoryTypes = NOTIFICATION_CATEGORIES[args.category] ?? [];
    const categoryTypeSet = new Set(categoryTypes);
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
      .filter((n) => categoryTypeSet.has(n.type))
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
// Internal: Send Notifications
// ============================================

/**
 * Internal: Send notification to a single user
 */
export const sendNotification = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    // Additional data for email templates
    emailData: v.optional(
      v.object({
        // For loan notifications
        loanId: v.optional(v.string()),
        itemName: v.optional(v.string()),
        borrowerName: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        loanUrl: v.optional(v.string()),
        // For task assignments
        taskTitle: v.optional(v.string()),
        assignedBy: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        taskUrl: v.optional(v.string()),
      }),
    ),
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

    // Send email notification if user has instant email enabled
    await ctx.runMutation(internal.notifications.sendEmailNotification, {
      organizationId: args.organizationId,
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      relatedEntityId: args.relatedEntityId,
      emailData: args.emailData,
    });

    return notificationId;
  },
});

/**
 * Internal: Send notification to multiple users
 */
export const sendNotificationToUsers = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userIds: v.array(v.id("users")),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await Promise.all(
      Array.from(args.userIds).map(async (userId) => {
        await ctx.db.insert("notifications", {
          organizationId: args.organizationId,
          userId,
          type: args.type,
          title: args.title,
          message: args.message,
          read: false,
          relatedEntityType: args.relatedEntityType,
          relatedEntityId: args.relatedEntityId,
          createdAt: now,
        });

        // Send email notification if user has instant email enabled
        await ctx.runMutation(internal.notifications.sendEmailNotification, {
          organizationId: args.organizationId,
          userId,
          type: args.type,
          title: args.title,
          message: args.message,
          relatedEntityId: args.relatedEntityId,
        });
      }),
    );

    return args.userIds.length;
  },
});

/**
 * Internal: Send notification to all users with a specific permission
 */
export const notifyUsersWithPermission = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    permission: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    excludeUserId: v.optional(v.id("users")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userIds = await getUserIdsWithPermission(
      ctx,
      args.organizationId,
      args.permission,
      { excludeUserId: args.excludeUserId },
    );

    if (userIds.length === 0) {
      return 0;
    }

    // Inline notification creation to avoid circular type reference
    const now = Date.now();

    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        await ctx.db.insert("notifications", {
          organizationId: args.organizationId,
          userId,
          type: args.type,
          title: args.title,
          message: args.message,
          read: false,
          relatedEntityType: args.relatedEntityType,
          relatedEntityId: args.relatedEntityId,
          createdAt: now,
        });
      }),
    );

    return userIds.length;
  },
});

/**
 * Internal: Send loan due reminder
 */
export const sendLoanDueReminder = internalMutation({
  args: {
    loanId: v.id("loans"),
    daysUntilDue: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return null;
    }

    const type =
      args.daysUntilDue <= 0
        ? NOTIFICATION_TYPES.LOAN_OVERDUE
        : NOTIFICATION_TYPES.LOAN_DUE_SOON;

    const title =
      args.daysUntilDue <= 0
        ? `Loan Overdue: ${loan.loanNumber}`
        : `Loan Due Soon: ${loan.loanNumber}`;

    const message =
      args.daysUntilDue <= 0
        ? `Loan ${loan.loanNumber} is overdue and requires immediate attention.`
        : `Loan ${loan.loanNumber} is due in ${args.daysUntilDue} days.`;

    // Notify users with loan management permission
    await ctx.runMutation(internal.notifications.notifyUsersWithPermission, {
      organizationId: loan.organizationId,
      permission: "loans.update",
      type,
      title,
      message,
      relatedEntityType: "loan",
      relatedEntityId: args.loanId,
    });

    return null;
  },
});

/**
 * Internal: Send approval request notification
 */
export const sendApprovalRequest = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.union(
      v.literal("loan"),
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("exhibition"),
      v.literal("conservation"),
      v.literal("move_request"),
    ),
    entityId: v.string(),
    entityNumber: v.string(),
    requestedByUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const typeMap: Record<
      string,
      { type: string; title: string; permission: string }
    > = {
      loan: {
        type: NOTIFICATION_TYPES.LOAN_PENDING_APPROVAL,
        title: `Loan Pending Approval: ${args.entityNumber}`,
        permission: "loans.approve",
      },
      accession: {
        type: NOTIFICATION_TYPES.ACCESSION_PENDING_APPROVAL,
        title: `Accession Pending Approval: ${args.entityNumber}`,
        permission: "collections.approve_accession",
      },
      deaccession: {
        type: NOTIFICATION_TYPES.DEACCESSION_PENDING_APPROVAL,
        title: `Deaccession Pending Approval: ${args.entityNumber}`,
        permission: "collections.approve_deaccession",
      },
      exhibition: {
        type: NOTIFICATION_TYPES.EXHIBITION_PENDING_APPROVAL,
        title: `Exhibition Pending Approval: ${args.entityNumber}`,
        permission: "collections.approve_exhibition",
      },
      conservation: {
        type: NOTIFICATION_TYPES.CONSERVATION_PENDING_APPROVAL,
        title: `Conservation Treatment Pending: ${args.entityNumber}`,
        permission: "collections.approve_conservation",
      },
      move_request: {
        type: NOTIFICATION_TYPES.MOVE_REQUEST_CREATED,
        title: `Move Request Created: ${args.entityNumber}`,
        permission: "locations.update",
      },
    };

    const config = typeMap[args.entityType];
    if (!config) {
      return null;
    }

    await ctx.runMutation(internal.notifications.notifyUsersWithPermission, {
      organizationId: args.organizationId,
      permission: config.permission,
      type: config.type,
      title: config.title,
      message: `A new ${args.entityType.replace("_", " ")} requires your review and approval.`,
      relatedEntityType: args.entityType,
      relatedEntityId: args.entityId,
      excludeUserId: args.requestedByUserId,
    });

    return null;
  },
});

/**
 * Internal: Send batch job completion notification
 */
export const sendBatchJobCompleted = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    jobId: v.id("batchJobs"),
    jobType: v.string(),
    totalItems: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const jobTypeLabels: Record<string, string> = {
      bulk_edit: "Bulk Edit",
      bulk_move: "Bulk Move",
      bulk_status_change: "Bulk Status Change",
      bulk_delete: "Bulk Delete",
      bulk_export: "Bulk Export",
    };

    const label = jobTypeLabels[args.jobType] ?? args.jobType;
    const status =
      args.failureCount === 0
        ? "completed successfully"
        : `completed with ${args.failureCount} errors`;

    await ctx.runMutation(internal.notifications.sendNotification, {
      organizationId: args.organizationId,
      userId: args.userId,
      type: NOTIFICATION_TYPES.BATCH_JOB_COMPLETED,
      title: `${label} ${status}`,
      message: `Processed ${args.successCount} of ${args.totalItems} items.`,
      relatedEntityType: "batch_job",
      relatedEntityId: args.jobId,
    });

    return null;
  },
});

// ============================================
// Notification Preferences
// ============================================

/**
 * Get notification preferences for current user
 */
export const getPreferences = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      enableApprovals: v.boolean(),
      enableReminders: v.boolean(),
      enableAlerts: v.boolean(),
      enableAssignments: v.boolean(),
      enableSystem: v.boolean(),
      disabledTypes: v.array(v.string()),
      emailEnabled: v.boolean(),
      emailDigestFrequency: v.string(),
      quietHoursEnabled: v.boolean(),
      quietHoursStart: v.optional(v.string()),
      quietHoursEnd: v.optional(v.string()),
      timezone: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .first();

    // Return defaults if no preferences set
    return {
      enableApprovals: prefs?.enableApprovals ?? true,
      enableReminders: prefs?.enableReminders ?? true,
      enableAlerts: prefs?.enableAlerts ?? true,
      enableAssignments: prefs?.enableAssignments ?? true,
      enableSystem: prefs?.enableSystem ?? true,
      disabledTypes: prefs?.disabledTypes ?? [],
      emailEnabled: prefs?.emailEnabled ?? false,
      emailDigestFrequency: prefs?.emailDigestFrequency ?? "never",
      quietHoursEnabled: prefs?.quietHoursEnabled ?? false,
      quietHoursStart: prefs?.quietHoursStart,
      quietHoursEnd: prefs?.quietHoursEnd,
      timezone: prefs?.timezone,
    };
  },
});

/**
 * Update notification preferences
 */
export const updatePreferences = mutation({
  args: {
    organizationId: v.id("organizations"),
    enableApprovals: v.optional(v.boolean()),
    enableReminders: v.optional(v.boolean()),
    enableAlerts: v.optional(v.boolean()),
    enableAssignments: v.optional(v.boolean()),
    enableSystem: v.optional(v.boolean()),
    disabledTypes: v.optional(v.array(v.string())),
    emailEnabled: v.optional(v.boolean()),
    emailDigestFrequency: v.optional(
      v.union(
        v.literal("instant"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("never"),
      ),
    ),
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .first();

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.enableApprovals !== undefined)
      updates.enableApprovals = args.enableApprovals;
    if (args.enableReminders !== undefined)
      updates.enableReminders = args.enableReminders;
    if (args.enableAlerts !== undefined)
      updates.enableAlerts = args.enableAlerts;
    if (args.enableAssignments !== undefined)
      updates.enableAssignments = args.enableAssignments;
    if (args.enableSystem !== undefined)
      updates.enableSystem = args.enableSystem;
    if (args.disabledTypes !== undefined)
      updates.disabledTypes = args.disabledTypes;
    if (args.emailEnabled !== undefined)
      updates.emailEnabled = args.emailEnabled;
    if (args.emailDigestFrequency !== undefined)
      updates.emailDigestFrequency = args.emailDigestFrequency;
    if (args.quietHoursEnabled !== undefined)
      updates.quietHoursEnabled = args.quietHoursEnabled;
    if (args.quietHoursStart !== undefined)
      updates.quietHoursStart = args.quietHoursStart;
    if (args.quietHoursEnd !== undefined)
      updates.quietHoursEnd = args.quietHoursEnd;
    if (args.timezone !== undefined) updates.timezone = args.timezone;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId,
        organizationId: args.organizationId,
        ...updates,
      });
    }

    return null;
  },
});

/**
 * Check if a notification should be sent based on user preferences
 */
export const shouldSendNotification = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    notificationType: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    // If no preferences, allow all notifications
    if (!prefs) {
      return true;
    }

    // Check if type is explicitly disabled
    if (prefs.disabledTypes?.includes(args.notificationType)) {
      return false;
    }

    // Check category preferences
    const category = getCategoryForType(args.notificationType);

    switch (category) {
      case "approvals":
        return prefs.enableApprovals !== false;
      case "reminders":
        return prefs.enableReminders !== false;
      case "alerts":
        return prefs.enableAlerts !== false;
      case "assignments":
        return prefs.enableAssignments !== false;
      case "system":
        return prefs.enableSystem !== false;
      default:
        return true;
    }
  },
});

// ============================================
// Helpers
// ============================================

function getCategoryForType(type: string): string {
  return NOTIFICATION_TYPE_TO_CATEGORY.get(type) ?? "system";
}

/**
 * Get user email by user ID
 * Returns null if user not found or email not set
 */
async function getUserEmail(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return null;
  }
  return user.email ?? null;
}

/**
 * Internal: Send email notification based on notification type
 * Checks user email preferences and sends appropriate email template
 */
export const sendEmailNotification = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityId: v.optional(v.string()),
    // Additional data for email templates
    emailData: v.optional(
      v.object({
        // For loan notifications
        loanId: v.optional(v.string()),
        itemName: v.optional(v.string()),
        borrowerName: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        loanUrl: v.optional(v.string()),
        // For task assignments
        taskTitle: v.optional(v.string()),
        assignedBy: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        taskUrl: v.optional(v.string()),
      }),
    ),
  },
  returns: v.union(v.boolean(), v.null()),
  handler: async (ctx, args) => {
    // Get user preferences
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    // Check if email notifications are enabled and set to instant delivery
    const emailEnabled = prefs?.emailEnabled ?? false;
    const emailDigestFrequency = prefs?.emailDigestFrequency ?? "never";

    if (!emailEnabled || emailDigestFrequency !== "instant") {
      return null; // Email not enabled or not instant, skip sending
    }

    // Get user email
    const userEmail = await getUserEmail(ctx, args.userId);
    if (!userEmail) {
      return null; // No email address, cannot send
    }

    // Send appropriate email based on notification type via actions (runs in Node.js)
    const emailData = args.emailData ?? {};

    switch (args.type) {
      case NOTIFICATION_TYPES.LOAN_APPROVED:
        if (
          emailData.loanId &&
          emailData.itemName &&
          emailData.borrowerName &&
          emailData.startDate &&
          emailData.endDate
        ) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.actions.sendLoanApprovedEmailAction,
            {
              email: userEmail,
              loanId: emailData.loanId,
              itemName: emailData.itemName,
              borrowerName: emailData.borrowerName,
              startDate: emailData.startDate,
              endDate: emailData.endDate,
              loanUrl: emailData.loanUrl,
            },
          );
          return true;
        }
        break;

      case NOTIFICATION_TYPES.LOAN_REJECTED:
        if (
          emailData.loanId &&
          emailData.itemName &&
          emailData.borrowerName &&
          emailData.startDate &&
          emailData.endDate
        ) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.actions.sendLoanRejectedEmailAction,
            {
              email: userEmail,
              loanId: emailData.loanId,
              itemName: emailData.itemName,
              borrowerName: emailData.borrowerName,
              startDate: emailData.startDate,
              endDate: emailData.endDate,
              loanUrl: emailData.loanUrl,
            },
          );
          return true;
        }
        break;

      case NOTIFICATION_TYPES.LOAN_PENDING_APPROVAL:
        if (
          emailData.loanId &&
          emailData.itemName &&
          emailData.borrowerName &&
          emailData.startDate &&
          emailData.endDate
        ) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.actions.sendLoanPendingEmailAction,
            {
              email: userEmail,
              loanId: emailData.loanId,
              itemName: emailData.itemName,
              borrowerName: emailData.borrowerName,
              startDate: emailData.startDate,
              endDate: emailData.endDate,
              loanUrl: emailData.loanUrl,
            },
          );
          return true;
        }
        break;

      case NOTIFICATION_TYPES.TASK_ASSIGNED:
        if (emailData.taskTitle && emailData.assignedBy) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.actions.sendTaskAssignedEmailAction,
            {
              email: userEmail,
              taskTitle: emailData.taskTitle,
              assignedBy: emailData.assignedBy,
              dueDate: emailData.dueDate,
              taskUrl: emailData.taskUrl,
            },
          );
          return true;
        }
        break;

      default:
        // Notification type not configured for email, skip
        return null;
    }

    return null; // Missing required email data
  },
});
