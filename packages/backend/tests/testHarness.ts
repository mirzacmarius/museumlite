import { convexTest } from "convex-test";
import { vi } from "vitest";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import {
  type CustodyConflictData,
  custodyConflictFromError,
} from "../convex/utils/custodyErrors";
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

/** Narrows a projection-backed metric result, failing the test when unavailable. */
export function expectReady<T extends { availability: string }>(
  result: T,
): Extract<T, { availability: "ready" }> {
  if (result.availability !== "ready") {
    throw new Error(`Metrics unavailable: ${JSON.stringify(result)}`);
  }
  return result as Extract<T, { availability: "ready" }>;
}

/**
 * Fixture rows inserted with `t.run` bypass mutation triggers, exactly like a
 * restore or dashboard import. Rebuild the organization's projection from its
 * source rows before asserting maintained metrics.
 */
export async function rebuildProjection(
  t: ConvexTest,
  organizationId: Id<"organizations">,
) {
  const fakeTimers = vi.isFakeTimers();
  if (!fakeTimers) vi.useFakeTimers();
  try {
    await t.mutation(internal.projections.startRebuildForOrganization, {
      organizationId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    if (!fakeTimers) vi.useRealTimers();
  }
}

/** Awaits a call expected to fail and returns its custody conflict payload. */
export async function custodyConflictOf(
  call: Promise<unknown>,
): Promise<CustodyConflictData | null> {
  try {
    await call;
  } catch (error) {
    return custodyConflictFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}
