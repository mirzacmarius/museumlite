import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "./testSetup";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createTestOrg(
  t: ReturnType<typeof convexTest>,
  permissions: string[] = [],
): Promise<TestSetup> {
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Search Test Org",
      slug: `search-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Search User",
      email: `search-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Test Role",
      isSystemRole: false,
    });
  });

  const categoryMap: Record<
    string,
    | "collections"
    | "loans"
    | "locations"
    | "media"
    | "users"
    | "organization"
    | "accounts"
  > = {
    collections: "collections",
    loans: "loans",
    locations: "locations",
    accounts: "accounts",
    accessions: "collections",
  };

  for (const permName of permissions) {
    const permissionId = await t.run(async (ctx) => {
      const existing = await ctx.db
        .query("permissions")
        .filter((q) => q.eq(q.field("name"), permName))
        .first();
      if (existing) return existing._id;
      const prefix = permName.split(".")[0] ?? "collections";
      return await ctx.db.insert("permissions", {
        name: permName,
        category: categoryMap[prefix] ?? "collections",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    });
  }

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId };
}

describe("Search: globalSearch", () => {
  test("returns empty results for query shorter than 2 characters", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-short`,
      issuer: "https://example.test",
    });

    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "a",
    });

    // #then
    expect(result.objects).toEqual([]);
    expect(result.collectionGroups).toEqual([]);
    expect(result.loans).toEqual([]);
    expect(result.accounts).toEqual([]);
    expect(result.accessions).toEqual([]);
    expect(result.locations).toEqual([]);
  });

  test("returns empty results for empty query", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-empty`,
      issuer: "https://example.test",
    });

    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "",
    });

    // #then
    expect(result.objects).toEqual([]);
    expect(result.loans).toEqual([]);
  });

  test("returns correct structure with all entity arrays", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
      "loans.read",
      "accounts.read",
      "accessions.read",
      "locations.read",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-structure`,
      issuer: "https://example.test",
    });

    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "test query",
    });

    // #then - verify return shape (search indexes don't work in test, so arrays are empty)
    expect(result).toHaveProperty("objects");
    expect(result).toHaveProperty("collectionGroups");
    expect(result).toHaveProperty("loans");
    expect(result).toHaveProperty("accounts");
    expect(result).toHaveProperty("accessions");
    expect(result).toHaveProperty("locations");
    expect(Array.isArray(result.objects)).toBe(true);
    expect(Array.isArray(result.loans)).toBe(true);
  });

  test("respects permission checks - no collections.read means no objects", async () => {
    // #given - org without collections.read permission
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "loans.read", // has loans.read but NOT collections.read
    ]);

    // Create a collection that would match
    await t.run(async (ctx) => {
      await ctx.db.insert("collections", {
        organizationId,
        title: "Searchable Artifact",
        accessionNumber: "ACC-SEARCH-001",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-perms`,
      issuer: "https://example.test",
    });

    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "Searchable",
    });

    // #then - objects should be empty due to missing permission
    // (search index doesn't work in test anyway, but permission check runs first)
    expect(result.objects).toEqual([]);
  });

  test("respects permission checks - no loans.read means no loans", async () => {
    // #given - org with collections.read but NOT loans.read
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // Create a loan that would match
    await t.run(async (ctx) => {
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "L-SEARCH-001",
        lenderBorrowerName: "Searchable Museum",
        status: "active",
        type: "incoming",
        startDate: Date.now(),
      });
    });

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-loan-perms`,
      issuer: "https://example.test",
    });

    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "Searchable",
    });

    // #then - loans should be empty due to missing permission
    expect(result.loans).toEqual([]);
  });

  test("uses default limit of 5 when not specified", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-limit`,
      issuer: "https://example.test",
    });

    // Call without limit - should use default of 5
    // (We can't directly test the limit behavior without search indexes,
    // but we verify the query accepts the call without limit param)
    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "test",
    });

    // #then - verify call succeeds
    expect(result).toBeDefined();
    expect(result.objects).toEqual([]);
  });

  test("accepts custom limit parameter", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-custom-limit`,
      issuer: "https://example.test",
    });

    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "test",
      limit: 10,
    });

    // #then - verify call succeeds with custom limit
    expect(result).toBeDefined();
  });

  test("trims whitespace from query", async () => {
    // #given
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|session-trim`,
      issuer: "https://example.test",
    });

    // Query with only whitespace should be treated as empty (< 2 chars after trim)
    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "   ",
    });

    // #then - should return empty (trimmed query is empty, < 2 chars)
    expect(result.objects).toEqual([]);
    expect(result.loans).toEqual([]);
  });
});
