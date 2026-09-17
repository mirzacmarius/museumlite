import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

/**
 * NOTE: The notifications module uses @convex-dev/auth's getAuthUserId() for authentication.
 * convex-test's `{ as: userId }` parameter doesn't fully mock the @convex-dev/auth session,
 * so we primarily test using internal mutations and direct database operations to verify
 * the business logic.
 */

// ============================================
// Notification Center Tests (via database inspection)
// ============================================

describe("notification center data structure", () => {
  test("should create notifications with proper structure", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create notifications using sendNotification internal mutation
    const notificationId = await t.mutation(
      internal.notifications.sendNotification,
      {
        organizationId: orgId,
        userId,
        type: "loan_pending_approval",
        title: "Loan Pending Approval",
        message: "A new loan requires your review",
        relatedEntityType: "loan",
        relatedEntityId: "loan_123",
      },
    );

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification).toBeDefined();
    expect(notification?.organizationId).toBe(orgId);
    expect(notification?.userId).toBe(userId);
    expect(notification?.type).toBe("loan_pending_approval");
    expect(notification?.title).toBe("Loan Pending Approval");
    expect(notification?.message).toBe("A new loan requires your review");
    expect(notification?.read).toBe(false);
    expect(notification?.relatedEntityType).toBe("loan");
    expect(notification?.relatedEntityId).toBe("loan_123");
    expect(notification?.createdAt).toBeDefined();
  });

  test("should create notifications with different categories", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create notifications of different types
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_pending_approval",
      title: "Approval",
      message: "Approval needed",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "task_assigned",
      title: "Task",
      message: "Task assigned",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_due_soon",
      title: "Reminder",
      message: "Loan due soon",
    });

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.type)).toContain("loan_pending_approval");
    expect(notifications.map((n) => n.type)).toContain("task_assigned");
    expect(notifications.map((n) => n.type)).toContain("loan_due_soon");
  });
});

describe("notification queries with indexes", () => {
  test("getUnreadCount and markAllRead stay scoped to one organization", async () => {
    const t = convexTest(schema, modules);

    const { organizationAId, organizationBId, userId } = await t.run(
      async (ctx) => {
        const [organizationAId, organizationBId, userId] = await Promise.all([
          ctx.db.insert("organizations", {
            name: "Org A",
            slug: "org-a",
            type: "museum",
          }),
          ctx.db.insert("organizations", {
            name: "Org B",
            slug: "org-b",
            type: "museum",
          }),
          ctx.db.insert("users", {
            name: "Unread Counter User",
            email: "unread-counter@example.com",
          }),
        ]);
        await ctx.db.insert("notifications", {
          organizationId: organizationAId,
          userId,
          type: "loan_pending_approval",
          title: "Unread A1",
          message: "Unread in org A",
          read: false,
          createdAt: Date.now(),
        });
        await ctx.db.insert("notifications", {
          organizationId: organizationAId,
          userId,
          type: "task_assigned",
          title: "Unread A2",
          message: "Also unread in org A",
          read: false,
          createdAt: Date.now() + 1,
        });
        await ctx.db.insert("notifications", {
          organizationId: organizationBId,
          userId,
          type: "loan_due_soon",
          title: "Unread B1",
          message: "Unread in org B",
          read: false,
          createdAt: Date.now() + 2,
        });

        return { organizationAId, organizationBId, userId };
      },
    );

    const authed = authedForUser(t, userId);

    expect(
      await authed.query(api.notifications.getUnreadCount, {
        organizationId: organizationAId,
      }),
    ).toBe(2);
    expect(
      await authed.query(api.notifications.getUnreadCount, {
        organizationId: organizationBId,
      }),
    ).toBe(1);

    await authed.mutation(api.notifications.markAllRead, {
      organizationId: organizationAId,
    });

    expect(
      await authed.query(api.notifications.getUnreadCount, {
        organizationId: organizationAId,
      }),
    ).toBe(0);
    expect(
      await authed.query(api.notifications.getUnreadCount, {
        organizationId: organizationBId,
      }),
    ).toBe(1);
  });

  test("hides missing insurance coverage notices from unread count and center", async () => {
    const t = convexTest(schema, modules);

    const { organizationId, userId } = await t.run(async (ctx) => {
      const [organizationId, userId] = await Promise.all([
        ctx.db.insert("organizations", {
          name: "Coverage Org",
          slug: "coverage-org",
          type: "museum",
        }),
        ctx.db.insert("users", {
          name: "Coverage User",
          email: "coverage@example.com",
        }),
      ]);

      await ctx.db.insert("notifications", {
        organizationId,
        userId,
        type: "missing_coverage",
        title: "Objects Missing Insurance Coverage",
        message:
          "12 of 20 objects (40%) are not covered by any insurance policy.",
        read: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("notifications", {
        organizationId,
        userId,
        type: "loan_due_soon",
        title: "Loan due soon",
        message: "A loan is due in 3 days",
        read: false,
        createdAt: Date.now() + 1,
      });

      return { organizationId, userId };
    });

    const authed = authedForUser(t, userId);

    expect(
      await authed.query(api.notifications.getUnreadCount, {
        organizationId,
      }),
    ).toBe(1);

    const center = await authed.query(api.notifications.getNotificationCenter, {
      organizationId,
    });

    expect(center.unreadCount).toBe(1);
    expect(
      center.notifications.map((notification) => notification.title),
    ).toEqual(["Loan due soon"]);
  });

  test("should query notifications by user", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId1, userId2] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 1",
          email: "user1@example.com",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 2",
          email: "user2@example.com",
        });
      }),
    ]);
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId: userId1,
      type: "loan_approved",
      title: "Loan Approved",
      message: "Your loan has been approved",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId: userId2,
      type: "loan_approved",
      title: "Loan Approved",
      message: "Your loan has been approved",
    });

    const [user1Notifications, user2Notifications] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", userId1))
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", userId2))
          .collect();
      }),
    ]);
    expect(user1Notifications).toHaveLength(1);
    expect(user2Notifications).toHaveLength(1);
    expect(user1Notifications[0].userId).toBe(userId1);
    expect(user2Notifications[0].userId).toBe(userId2);
  });

  test("should query unread notifications by user", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create unread notification
    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_pending_approval",
        title: "Unread Notification",
        message: "This is unread",
        read: false,
        createdAt: Date.now(),
      });
    });

    // Create read notification
    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Read Notification",
        message: "This is read",
        read: true,
        createdAt: Date.now(),
      });
    });

    const unreadNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });

    expect(unreadNotifications).toHaveLength(1);
    expect(unreadNotifications[0].read).toBe(false);
    expect(unreadNotifications[0].title).toBe("Unread Notification");
  });
});

// ============================================
// CRUD Operations Tests (via database)
// ============================================

describe("notification CRUD operations", () => {
  test("should mark notification as read via database", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Loan Approved",
        message: "Your loan has been approved",
        read: false,
        createdAt: Date.now(),
      });
    });

    // Mark as read
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationId, { read: true });
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification?.read).toBe(true);
  });

  test("should mark notification as unread via database", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Loan Approved",
        message: "Your loan has been approved",
        read: true,
        createdAt: Date.now(),
      });
    });

    // Mark as unread
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationId, { read: false });
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification?.read).toBe(false);
  });

  test("should delete notification via database", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Loan Approved",
        message: "Your loan has been approved",
        read: true,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(notificationId);
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification).toBeNull();
  });

  test("should bulk mark notifications as read", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationIds = await t.run(async (ctx) => {
      const ids = [];
      const insertedIds = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          ctx.db.insert("notifications", {
            organizationId: orgId,
            userId,
            type: "loan_pending_approval",
            title: `Notification ${i}`,
            message: `Message ${i}`,
            read: false,
            createdAt: Date.now(),
          }),
        ),
      );
      ids.push(...insertedIds);
      return ids;
    });

    // Bulk mark as read
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from(notificationIds).map(async (id) => {
          await ctx.db.patch(id, { read: true });
        }),
      );
    });

    const notifications = await t.run(async (ctx) => {
      return await Promise.all(notificationIds.map((id) => ctx.db.get(id)));
    });

    expect(notifications.every((n) => n?.read === true)).toBe(true);
  });

  test("bulkDelete returns accurate count for multiple owned notifications", async () => {
    const t = convexTest(schema, modules);

    const { ownerId, notificationIds } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Bulk Delete Org",
        slug: "bulk-delete-org",
        type: "museum",
      });
      const ownerId = await ctx.db.insert("users", {
        name: "Owner",
        email: "owner@example.com",
      });
      const otherUserId = await ctx.db.insert("users", {
        name: "Other User",
        email: "other@example.com",
      });

      const notificationIds = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          ctx.db.insert("notifications", {
            organizationId: orgId,
            userId: ownerId,
            type: "task_assigned",
            title: `Owned ${i}`,
            message: `Message ${i}`,
            read: false,
            createdAt: Date.now() + i,
          }),
        ),
      );

      const otherUserNotificationId = await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId: otherUserId,
        type: "task_assigned",
        title: "Other user notification",
        message: "Should not be deleted",
        read: false,
        createdAt: Date.now(),
      });

      return {
        ownerId,
        notificationIds: [...notificationIds, otherUserNotificationId],
      };
    });

    const authed = authedForUser(t, ownerId);
    const deletedCount = await authed.mutation(api.notifications.bulkDelete, {
      notificationIds,
    });

    expect(deletedCount).toBe(4);

    const remaining = await t.run(async (ctx) => {
      return await Promise.all(notificationIds.map((id) => ctx.db.get(id)));
    });

    expect(remaining.filter((n) => n?.userId === ownerId)).toHaveLength(0);
    expect(
      remaining.find((n) => n !== null && n.userId !== ownerId),
    ).toBeDefined();
  });

  test("should bulk delete notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationIds = await t.run(async (ctx) => {
      const ids = [];
      const insertedIds = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          ctx.db.insert("notifications", {
            organizationId: orgId,
            userId,
            type: "loan_pending_approval",
            title: `Notification ${i}`,
            message: `Message ${i}`,
            read: false,
            createdAt: Date.now(),
          }),
        ),
      );
      ids.push(...insertedIds);
      return ids;
    });

    // Bulk delete
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from(notificationIds).map(async (id) => {
          await ctx.db.delete(id);
        }),
      );
    });

    const notifications = await t.run(async (ctx) => {
      return await Promise.all(notificationIds.map((id) => ctx.db.get(id)));
    });

    expect(notifications.every((n) => n === null)).toBe(true);
  });
});

describe("notification cleanup", () => {
  test("should identify old read notifications for cleanup", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const now = Date.now();
    const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
    const twentyNineDaysAgo = now - 29 * 24 * 60 * 60 * 1000;

    await t.run(async (ctx) => {
      // Old read notification - should be deleted
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Old read",
        message: "Old read message",
        read: true,
        createdAt: thirtyOneDaysAgo,
      });

      // Recent read notification - should be kept
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Recent read",
        message: "Recent read message",
        read: true,
        createdAt: twentyNineDaysAgo,
      });

      // Old unread notification - should be kept
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_pending_approval",
        title: "Old unread",
        message: "Old unread message",
        read: false,
        createdAt: thirtyOneDaysAgo,
      });
    });

    const cutoff = now - 30 * 24 * 60 * 60 * 1000;

    const oldReadNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", true),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("organizationId"), orgId),
            q.lt(q.field("createdAt"), cutoff),
          ),
        )
        .collect();
    });

    expect(oldReadNotifications).toHaveLength(1);
    expect(oldReadNotifications[0].title).toBe("Old read");
  });
});

// ============================================
// Notification Preferences Tests
// ============================================

describe("notification preferences", () => {
  test("should store notification preferences", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const prefId = await t.run(async (ctx) => {
      return await ctx.db.insert("notificationPreferences", {
        userId,
        organizationId: orgId,
        enableApprovals: false,
        enableReminders: true,
        enableAlerts: true,
        enableAssignments: true,
        enableSystem: false,
        disabledTypes: ["loan_due_soon"],
        emailEnabled: true,
        emailDigestFrequency: "daily",
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        timezone: "America/New_York",
      });
    });

    const prefs = await t.run(async (ctx) => {
      return await ctx.db.get(prefId);
    });

    expect(prefs).toBeDefined();
    expect(prefs?.enableApprovals).toBe(false);
    expect(prefs?.enableReminders).toBe(true);
    expect(prefs?.emailEnabled).toBe(true);
    expect(prefs?.emailDigestFrequency).toBe("daily");
    expect(prefs?.quietHoursEnabled).toBe(true);
    expect(prefs?.quietHoursStart).toBe("22:00");
    expect(prefs?.quietHoursEnd).toBe("08:00");
    expect(prefs?.timezone).toBe("America/New_York");
    expect(prefs?.disabledTypes).toContain("loan_due_soon");
  });

  test("should query preferences by user and organization", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationPreferences", {
        userId,
        organizationId: orgId,
        enableApprovals: false,
        emailEnabled: true,
      });
    });

    const prefs = await t.run(async (ctx) => {
      return await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", orgId),
        )
        .first();
    });

    expect(prefs).toBeDefined();
    expect(prefs?.userId).toBe(userId);
    expect(prefs?.organizationId).toBe(orgId);
    expect(prefs?.enableApprovals).toBe(false);
    expect(prefs?.emailEnabled).toBe(true);
  });

  test("should update notification preferences", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const prefId = await t.run(async (ctx) => {
      return await ctx.db.insert("notificationPreferences", {
        userId,
        organizationId: orgId,
        enableApprovals: true,
        emailEnabled: false,
      });
    });

    // Update preferences
    await t.run(async (ctx) => {
      await ctx.db.patch(prefId, {
        enableApprovals: false,
        emailEnabled: true,
        updatedAt: Date.now(),
      });
    });

    const prefs = await t.run(async (ctx) => {
      return await ctx.db.get(prefId);
    });

    expect(prefs?.enableApprovals).toBe(false);
    expect(prefs?.emailEnabled).toBe(true);
    expect(prefs?.updatedAt).toBeDefined();
  });
});

// ============================================
// Internal Notification Functions Tests
// ============================================

describe("sendNotification", () => {
  test("should send notification to a single user", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.mutation(
      internal.notifications.sendNotification,
      {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Loan Approved",
        message: "Your loan has been approved",
        relatedEntityType: "loan",
        relatedEntityId: "loan_123",
      },
    );

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification).toBeDefined();
    expect(notification?.userId).toBe(userId);
    expect(notification?.type).toBe("loan_approved");
    expect(notification?.title).toBe("Loan Approved");
    expect(notification?.relatedEntityType).toBe("loan");
    expect(notification?.relatedEntityId).toBe("loan_123");
  });
});

describe("sendNotificationToUsers", () => {
  test("should send notifications to multiple users", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userIds] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        const _ids = [];
        return Promise.all(
          Array.from({ length: 3 }, (_, i) =>
            ctx.db.insert("users", {
              name: `User ${i}`,
              email: `user${i}@example.com`,
            }),
          ),
        );
      }),
    ]);
    const count = await t.mutation(
      internal.notifications.sendNotificationToUsers,
      {
        organizationId: orgId,
        userIds,
        type: "system_announcement",
        title: "System Announcement",
        message: "Important system update",
      },
    );

    expect(count).toBe(3);

    await Promise.all(
      userIds.map(async (notifyUserId) => {
        const notifications = await t.run(async (ctx) => {
          return await ctx.db
            .query("notifications")
            .withIndex("by_user", (q) => q.eq("userId", notifyUserId))
            .collect();
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0]?.title).toBe("System Announcement");
      }),
    );
  });
});

// ============================================
// Notification Category and Type Tests
// ============================================

describe("notification categories", () => {
  test("should correctly categorize approval notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create approval type notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_pending_approval",
      title: "Loan Approval",
      message: "Loan needs approval",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "accession_approved",
      title: "Accession Approved",
      message: "Accession was approved",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "exhibition_pending_approval",
      title: "Exhibition Approval",
      message: "Exhibition needs approval",
    });

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.type)).toContain("loan_pending_approval");
    expect(notifications.map((n) => n.type)).toContain("accession_approved");
    expect(notifications.map((n) => n.type)).toContain(
      "exhibition_pending_approval",
    );
  });

  test("should correctly categorize reminder notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create reminder type notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_due_soon",
      title: "Loan Due Soon",
      message: "Loan is due in 3 days",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "insurance_expiring",
      title: "Insurance Expiring",
      message: "Insurance expires soon",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_overdue",
      title: "Loan Overdue",
      message: "Loan is overdue",
    });

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.type)).toContain("loan_due_soon");
    expect(notifications.map((n) => n.type)).toContain("insurance_expiring");
    expect(notifications.map((n) => n.type)).toContain("loan_overdue");
  });

  test("should correctly categorize alert notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create alert type notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "condition_alert",
      title: "Condition Alert",
      message: "Item condition changed",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "environmental_alert",
      title: "Environmental Alert",
      message: "Temperature out of range",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "capacity_alert",
      title: "Capacity Alert",
      message: "Storage capacity exceeded",
    });

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.type)).toContain("condition_alert");
    expect(notifications.map((n) => n.type)).toContain("environmental_alert");
    expect(notifications.map((n) => n.type)).toContain("capacity_alert");
  });

  test("should correctly categorize assignment notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create assignment type notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "task_assigned",
      title: "Task Assigned",
      message: "New task assigned to you",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "task_completed",
      title: "Task Completed",
      message: "Task was completed",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "comment_mention",
      title: "Comment Mention",
      message: "You were mentioned in a comment",
    });

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.type)).toContain("task_assigned");
    expect(notifications.map((n) => n.type)).toContain("task_completed");
    expect(notifications.map((n) => n.type)).toContain("comment_mention");
  });

  test("should correctly categorize system notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create system type notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "batch_job_completed",
      title: "Batch Job Completed",
      message: "Your batch job finished",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "report_ready",
      title: "Report Ready",
      message: "Your report is ready",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "system_announcement",
      title: "System Announcement",
      message: "New system features available",
    });

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((n) => n.type)).toContain("batch_job_completed");
    expect(notifications.map((n) => n.type)).toContain("report_ready");
    expect(notifications.map((n) => n.type)).toContain("system_announcement");
  });
});

describe("notification category filtering", () => {
  test("should filter notifications by category - approvals only", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create mix of notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_pending_approval",
      title: "Approval 1",
      message: "Needs approval",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "task_assigned",
      title: "Assignment 1",
      message: "Task assigned",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "accession_approved",
      title: "Approval 2",
      message: "Was approved",
    });

    const allNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    // Manually filter by approval types
    const approvalTypes = [
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
    ];

    const approvalNotifications = allNotifications.filter((n) =>
      approvalTypes.includes(n.type),
    );

    expect(approvalNotifications).toHaveLength(2);
    expect(approvalNotifications.map((n) => n.type)).toContain(
      "loan_pending_approval",
    );
    expect(approvalNotifications.map((n) => n.type)).toContain(
      "accession_approved",
    );
  });

  test("should filter notifications by category - reminders only", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create mix of notifications
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "loan_due_soon",
      title: "Reminder 1",
      message: "Due soon",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "condition_alert",
      title: "Alert 1",
      message: "Condition changed",
    });

    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "insurance_expiring",
      title: "Reminder 2",
      message: "Expiring soon",
    });

    const allNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    // Manually filter by reminder types
    const reminderTypes = [
      "loan_due_soon",
      "loan_overdue",
      "insurance_expiring",
      "license_expiring",
      "assessment_due",
    ];

    const reminderNotifications = allNotifications.filter((n) =>
      reminderTypes.includes(n.type),
    );

    expect(reminderNotifications).toHaveLength(2);
    expect(reminderNotifications.map((n) => n.type)).toContain("loan_due_soon");
    expect(reminderNotifications.map((n) => n.type)).toContain(
      "insurance_expiring",
    );
  });

  test("should filter unread notifications by category", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create unread alert
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "condition_alert",
      title: "Unread Alert",
      message: "Needs attention",
    });

    // Create read alert
    const readAlertId = await t.mutation(
      internal.notifications.sendNotification,
      {
        organizationId: orgId,
        userId,
        type: "environmental_alert",
        title: "Read Alert",
        message: "Already seen",
      },
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(readAlertId, { read: true });
    });

    // Create unread assignment (different category)
    await t.mutation(internal.notifications.sendNotification, {
      organizationId: orgId,
      userId,
      type: "task_assigned",
      title: "Unread Task",
      message: "Task for you",
    });

    const allNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });

    // Filter unread alerts only
    const alertTypes = [
      "condition_alert",
      "environmental_alert",
      "capacity_alert",
    ];
    const unreadAlerts = allNotifications.filter((n) =>
      alertTypes.includes(n.type),
    );

    expect(unreadAlerts).toHaveLength(1);
    expect(unreadAlerts[0].type).toBe("condition_alert");
    expect(unreadAlerts[0].read).toBe(false);
  });
});

describe("notification type validation", () => {
  test("should accept all valid notification types", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const validTypes = [
      "loan_pending_approval",
      "loan_approved",
      "loan_rejected",
      "accession_pending_approval",
      "accession_approved",
      "deaccession_pending_approval",
      "loan_due_soon",
      "loan_overdue",
      "condition_alert",
      "task_assigned",
      "batch_job_completed",
      "system_announcement",
    ];

    await Promise.all(
      Array.from(validTypes).map(async (type) => {
        await t.mutation(internal.notifications.sendNotification, {
          organizationId: orgId,
          userId,
          type,
          title: `Test ${type}`,
          message: `Testing ${type}`,
        });
      }),
    );

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(notifications).toHaveLength(validTypes.length);
  });

  test("should store custom notification types", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // The schema allows any string for type, testing custom types
    const customType = "custom_notification_type";

    const notificationId = await t.mutation(
      internal.notifications.sendNotification,
      {
        organizationId: orgId,
        userId,
        type: customType,
        title: "Custom Type",
        message: "Custom notification",
      },
    );

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification?.type).toBe(customType);
  });
});

// ============================================
// Read/Unread State Management Tests
// ============================================

describe("notification read/unread state management", () => {
  test("should create notifications as unread by default", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.mutation(
      internal.notifications.sendNotification,
      {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "New Task",
        message: "You have a new task",
      },
    );

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification?.read).toBe(false);
  });

  test("should toggle notification from unread to read", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Loan Approved",
        message: "Your loan has been approved",
        read: false,
        createdAt: Date.now(),
      });
    });

    // Verify initial state
    const initialNotification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });
    expect(initialNotification?.read).toBe(false);

    // Toggle to read
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationId, { read: true });
    });

    const updatedNotification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });
    expect(updatedNotification?.read).toBe(true);
  });

  test("should toggle notification from read to unread", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "loan_approved",
        title: "Loan Approved",
        message: "Your loan has been approved",
        read: true,
        createdAt: Date.now(),
      });
    });

    // Verify initial state
    const initialNotification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });
    expect(initialNotification?.read).toBe(true);

    // Toggle to unread
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationId, { read: false });
    });

    const updatedNotification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });
    expect(updatedNotification?.read).toBe(false);
  });

  test("should handle marking already-read notification as read", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_completed",
        title: "Task Completed",
        message: "Task was completed",
        read: true,
        createdAt: Date.now(),
      });
    });

    // Mark as read again
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationId, { read: true });
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification?.read).toBe(true);
  });

  test("should handle marking already-unread notification as unread", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Task Assigned",
        message: "New task for you",
        read: false,
        createdAt: Date.now(),
      });
    });

    // Mark as unread again
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationId, { read: false });
    });

    const notification = await t.run(async (ctx) => {
      return await ctx.db.get(notificationId);
    });

    expect(notification?.read).toBe(false);
  });

  test("should correctly count unread notifications", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create 3 unread and 2 read notifications
    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Unread 1",
        message: "Message 1",
        read: false,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Unread 2",
        message: "Message 2",
        read: false,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Unread 3",
        message: "Message 3",
        read: false,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_completed",
        title: "Read 1",
        message: "Message 4",
        read: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_completed",
        title: "Read 2",
        message: "Message 5",
        read: true,
        createdAt: Date.now(),
      });
    });

    const unreadNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });

    expect(unreadNotifications).toHaveLength(3);
  });

  test("should update unread count after marking notification as read", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create 2 unread notifications
    const [notificationIds, initialUnread] = await Promise.all([
      t.run(async (ctx) => {
        const [id1, id2] = await Promise.all([
          ctx.db.insert("notifications", {
            organizationId: orgId,
            userId,
            type: "task_assigned",
            title: "Unread 1",
            message: "Message 1",
            read: false,
            createdAt: Date.now(),
          }),
          ctx.db.insert("notifications", {
            organizationId: orgId,
            userId,
            type: "task_assigned",
            title: "Unread 2",
            message: "Message 2",
            read: false,
            createdAt: Date.now(),
          }),
        ]);
        return [id1, id2];
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user_and_read", (q) =>
            q.eq("userId", userId).eq("read", false),
          )
          .collect();
      }),
    ]);

    // Verify initial count
    expect(initialUnread).toHaveLength(2);

    // Mark one as read
    await t.run(async (ctx) => {
      await ctx.db.patch(notificationIds[0], { read: true });
    });

    // Verify updated count
    const updatedUnread = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });
    expect(updatedUnread).toHaveLength(1);
  });

  test("should bulk mark multiple notifications as read", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    const notificationIds = await t.run(async (ctx) => {
      const ids = [];
      const insertedIds = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          ctx.db.insert("notifications", {
            organizationId: orgId,
            userId,
            type: "task_assigned",
            title: `Notification ${i}`,
            message: `Message ${i}`,
            read: false,
            createdAt: Date.now(),
          }),
        ),
      );
      ids.push(...insertedIds);
      return ids;
    });

    // Bulk mark as read
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from(notificationIds).map(async (id) => {
          await ctx.db.patch(id, { read: true });
        }),
      );
    });

    // Verify all are read
    const notifications = await t.run(async (ctx) => {
      return await Promise.all(notificationIds.map((id) => ctx.db.get(id)));
    });

    expect(notifications.every((n) => n?.read === true)).toBe(true);

    // Verify unread count is 0
    const unreadNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });

    expect(unreadNotifications).toHaveLength(0);
  });

  test("should maintain separate read states for different users", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId1, userId2] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 1",
          email: "user1@example.com",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User 2",
          email: "user2@example.com",
        });
      }),
    ]);
    // Create notifications for both users
    const user1NotificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId: userId1,
        type: "task_assigned",
        title: "User 1 Task",
        message: "Task for user 1",
        read: false,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId: userId2,
        type: "task_assigned",
        title: "User 2 Task",
        message: "Task for user 2",
        read: false,
        createdAt: Date.now(),
      });
    });

    // Mark user1's notification as read
    await t.run(async (ctx) => {
      await ctx.db.patch(user1NotificationId, { read: true });
    });

    // Verify user1 has no unread
    const [user1Unread, user2Unread] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user_and_read", (q) =>
            q.eq("userId", userId1).eq("read", false),
          )
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user_and_read", (q) =>
            q.eq("userId", userId2).eq("read", false),
          )
          .collect();
      }),
    ]);

    // Verify user2 still has 1 unread
    expect(user1Unread).toHaveLength(0);
    expect(user2Unread).toHaveLength(1);
  });

  test("should filter notifications by read state", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create mix of read and unread
    await t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Unread 1",
        message: "Message 1",
        read: false,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Read 1",
        message: "Message 2",
        read: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Unread 2",
        message: "Message 3",
        read: false,
        createdAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId: orgId,
        userId,
        type: "task_assigned",
        title: "Read 2",
        message: "Message 4",
        read: true,
        createdAt: Date.now(),
      });
    });

    // Query only unread
    const [unreadNotifications, readNotifications] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user_and_read", (q) =>
            q.eq("userId", userId).eq("read", false),
          )
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user_and_read", (q) =>
            q.eq("userId", userId).eq("read", true),
          )
          .collect();
      }),
    ]);

    // Query only read
    expect(unreadNotifications).toHaveLength(2);
    expect(readNotifications).toHaveLength(2);
    expect(unreadNotifications.every((n) => n.read === false)).toBe(true);
    expect(readNotifications.every((n) => n.read === true)).toBe(true);
  });

  test("should mark all unread notifications as read", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: "test@example.com",
        });
      }),
    ]);
    // Create multiple unread notifications
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          await ctx.db.insert("notifications", {
            organizationId: orgId,
            userId,
            type: "system_announcement",
            title: `Notification ${i}`,
            message: `Message ${i}`,
            read: false,
            createdAt: Date.now(),
          });
        }),
      );
    });

    // Get all unread notifications
    const unreadNotifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });

    expect(unreadNotifications).toHaveLength(10);

    // Mark all as read
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from(unreadNotifications).map(async (notification) => {
          await ctx.db.patch(notification._id, { read: true });
        }),
      );
    });

    // Verify all are now read
    const remainingUnread = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user_and_read", (q) =>
          q.eq("userId", userId).eq("read", false),
        )
        .collect();
    });

    expect(remainingUnread).toHaveLength(0);
  });
});
