import type { Id } from "../convex/_generated/dataModel";
import { notificationErrorCodeFromError } from "../convex/utils/notificationErrors";
import type { NotificationCategory } from "../convex/utils/notificationTypes";
import type { ConvexTest } from "./testHarness";

/** Adds a member whose username can be @mentioned and whose role has `permissionNames`. */
export async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  username: string,
  permissionNames: string[],
) {
  return await t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        name: username,
        username,
        email: `${username}@example.test`,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: `${username} role`,
        isSystemRole: false,
      }),
    ]);
    for (const name of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
}

type CategoryChoice = { enabled: boolean; email: boolean };

/** Every category notifying in the app only, with `overrides` applied. */
export function categoryChoices(
  overrides: Partial<Record<NotificationCategory, CategoryChoice>> = {},
): Record<NotificationCategory, CategoryChoice> {
  const inAppOnly = { enabled: true, email: false };
  return {
    approvals: inAppOnly,
    reminders: inAppOnly,
    alerts: inAppOnly,
    assignments: inAppOnly,
    system: inAppOnly,
    ...overrides,
  };
}

/** Every category notifying, and `emailed` ones also by email. */
export function emailChoices(emailed: NotificationCategory[]) {
  return categoryChoices(
    Object.fromEntries(
      emailed.map((category) => [category, { enabled: true, email: true }]),
    ),
  );
}

/** Awaits a call expected to fail and returns its notification error code. */
export async function notificationErrorOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return notificationErrorCodeFromError(error) ?? error;
  }
  throw new Error("Expected the call to be rejected");
}
