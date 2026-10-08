import { convexTest } from "convex-test";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import type { ModuleId } from "../convex/utils/moduleCatalog";

import { modules } from "./testSetup";

export type ConvexTest = ReturnType<typeof convexTest>;

export type SubscriptionTier = "free" | "pro" | "enterprise";

export interface TestOrgUserOptions {
  organizationName?: string;
  slugPrefix?: string;
  userName?: string;
  userEmailPrefix?: string;
  roleName?: string;
  subscriptionTier?: SubscriptionTier;
  enabledModules?: Array<ModuleId>;
  permissionCategoryFallback?: string;
}

export function createConvexTest() {
  return convexTest(schema, modules);
}

const rateLimiterModules = Object.fromEntries(
  Object.entries(
    import.meta.glob(
      "../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.{ts,js}",
    ),
  ).filter(([path]) => !path.endsWith(".d.ts")),
);

/** Test deployment with the rate-limiter component used by auth code requests. */
export function createConvexTestWithRateLimiter() {
  const t = createConvexTest();
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}

export function authedForUser(
  t: ConvexTest,
  userId: Id<"users">,
  sessionId = "session-1",
) {
  return t.withIdentity({
    subject: `${userId}|${sessionId}`,
    issuer: "https://example.test",
  });
}

export async function createOrgUserWithPermissions(
  t: ConvexTest,
  permissionNames: string[],
  options: TestOrgUserOptions = {},
) {
  return t.run(async (ctx) => {
    const slugPrefix = options.slugPrefix ?? "test-museum";
    const organizationId = await ctx.db.insert("organizations", {
      name: options.organizationName ?? "Test Museum",
      slug: `${slugPrefix}-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: options.subscriptionTier,
      settings:
        options.enabledModules !== undefined
          ? { enabledModules: options.enabledModules }
          : undefined,
    });

    const userEmailPrefix = options.userEmailPrefix ?? "user";
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        email: `${userEmailPrefix}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        name: options.userName ?? "Test User",
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: options.roleName ?? "Test Role",
        isSystemRole: false,
      }),
    ]);
    await Promise.all(
      permissionNames.map(async (permissionName) => {
        const permissionId = await ctx.db.insert("permissions", {
          name: permissionName,
          category:
            permissionName.split(".")[0] ??
            options.permissionCategoryFallback ??
            "collections",
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      }),
    );

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { organizationId, userId, roleId };
  });
}

export async function createOrgUserCollectionWithPermissions(
  t: ConvexTest,
  permissionNames: string[],
  options: TestOrgUserOptions = {},
) {
  const setup = await createOrgUserWithPermissions(t, permissionNames, options);
  const collectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId: setup.organizationId,
      accessionNumber: `OBJ-${Math.random().toString(36).slice(2, 8)}`,
      title: "Collection Object",
      status: "active",
      catalogedBy: setup.userId,
      catalogedAt: Date.now(),
    });
  });

  return { ...setup, collectionId };
}
