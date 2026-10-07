import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
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
  const [organizationId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Search Test Org",
        slug: `search-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Search User",
        email: `search-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    }),
  ]);
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

  await Promise.all(
    permissions.map(async (permName) => {
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
    }),
  );

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
    expect(result.exhibitions).toEqual([]);
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
    expect(result.exhibitions).toEqual([]);
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
    expect(result).toHaveProperty("exhibitions");
    expect(Array.isArray(result.objects)).toBe(true);
    expect(Array.isArray(result.loans)).toBe(true);
    expect(Array.isArray(result.exhibitions)).toBe(true);
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
    expect(result.exhibitions).toEqual([]);
  });
});

describe("Search: scoped identifier and descriptive matches (MUS-625)", () => {
  async function insertObject(
    t: ReturnType<typeof convexTest>,
    setup: TestSetup,
    fields: {
      accessionNumber: string;
      title: string;
      creator?: string;
      status?: "active" | "archived" | "deleted";
      indexed?: boolean;
    },
  ) {
    return await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber: fields.accessionNumber,
        normalizedIdentifier:
          fields.indexed === false
            ? undefined
            : fields.accessionNumber.trim().toLowerCase(),
        title: fields.title,
        creator: fields.creator,
        status: fields.status ?? "active",
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      }),
    );
  }

  function asUser(t: ReturnType<typeof convexTest>, setup: TestSetup) {
    return t.withIdentity({
      subject: `${setup.userId}|scoped-search`,
      issuer: "https://example.test",
    });
  }

  test("an identifier query returns its prefix matches, not lexical successors", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestOrg(t, ["collections.read"]);
    await insertObject(t, setup, {
      accessionNumber: "2024.001.001",
      title: "Brass compass",
    });
    await insertObject(t, setup, {
      accessionNumber: "2024.002.001",
      title: "Pocket watch",
    });
    await insertObject(t, setup, {
      accessionNumber: "ZZ-9",
      title: "Unrelated rope",
    });

    const result = await asUser(t, setup).query(api.search.globalSearch, {
      organizationId: setup.organizationId,
      query: "2024.001",
    });

    expect(result.objects.map((object) => object.accessionNumber)).toEqual([
      "2024.001.001",
    ]);
    expect(result.identifierIndexIncomplete).toBe(false);
  });

  test("descriptive queries match title and creator words, and exclude deleted records", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestOrg(t, ["collections.read"]);
    await insertObject(t, setup, {
      accessionNumber: "A-1",
      title: "Harbour at dusk",
      creator: "Edvard Munch",
    });
    await insertObject(t, setup, {
      accessionNumber: "A-2",
      title: "Munch study",
      status: "archived",
    });
    await insertObject(t, setup, {
      accessionNumber: "A-3",
      title: "Munch tombstone",
      status: "deleted",
    });
    await insertObject(t, setup, {
      accessionNumber: "A-4",
      title: "Fishing nets",
      creator: "Unknown",
    });

    const result = await asUser(t, setup).query(api.search.globalSearch, {
      organizationId: setup.organizationId,
      query: "munch",
      limit: 10,
    });

    expect(
      result.objects.map((object) => object.accessionNumber).sort(),
    ).toEqual(["A-1", "A-2"]);
    expect(
      result.objects.find((object) => object.accessionNumber === "A-2")?.status,
    ).toBe("archived");
  });

  test("other organizations' records never appear", async () => {
    const t = convexTest(schema, modules);
    const own = await createTestOrg(t, ["collections.read"]);
    const foreign = await createTestOrg(t, ["collections.read"]);
    await insertObject(t, foreign, {
      accessionNumber: "2024.001.009",
      title: "Foreign compass",
    });

    const result = await asUser(t, own).query(api.search.globalSearch, {
      organizationId: own.organizationId,
      query: "compass",
    });
    const byIdentifier = await asUser(t, own).query(api.search.globalSearch, {
      organizationId: own.organizationId,
      query: "2024.001",
    });

    expect(result.objects).toEqual([]);
    expect(byIdentifier.objects).toEqual([]);
  });

  test("accession search uses identifier prefixes within the organization", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestOrg(t, ["collections.read"]);
    for (const accessionNumber of ["ACC-2024-01", "ACC-2025-01"]) {
      await t.run((ctx) =>
        ctx.db.insert("accessions", {
          organizationId: setup.organizationId,
          accessionNumber,
          normalizedIdentifier: accessionNumber.toLowerCase(),
          dateReceived: Date.now(),
          source: "Donor",
          method: "gift",
          status: "pending",
        }),
      );
    }

    const result = await asUser(t, setup).query(api.search.globalSearch, {
      organizationId: setup.organizationId,
      query: "acc-2024",
    });

    expect(result.accessions.map((row) => row.accessionNumber)).toEqual([
      "ACC-2024-01",
    ]);
  });

  test("unindexed historical identifiers are matched in a bounded batch and disclosed when more remain", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestOrg(t, ["collections.read"]);
    await insertObject(t, setup, {
      accessionNumber: "1931.7",
      title: "Legacy ledger",
      indexed: false,
    });

    const small = await asUser(t, setup).query(api.search.globalSearch, {
      organizationId: setup.organizationId,
      query: "1931",
    });
    expect(small.objects.map((object) => object.accessionNumber)).toEqual([
      "1931.7",
    ]);
    expect(small.identifierIndexIncomplete).toBe(false);

    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("collections", {
          organizationId: setup.organizationId,
          accessionNumber: `L-${index}`,
          title: `Legacy ${index}`,
          status: "active",
          catalogedBy: setup.userId,
          catalogedAt: Date.now(),
        });
      }
    });
    const large = await asUser(t, setup).query(api.search.globalSearch, {
      organizationId: setup.organizationId,
      query: "1931",
    });
    expect(large.identifierIndexIncomplete).toBe(true);
  });

  test("suggestions come from indexed matches across the whole organization", async () => {
    const t = convexTest(schema, modules);
    const setup = await createTestOrg(t, ["collections.read"]);
    await t.run(async (ctx) => {
      for (let index = 0; index < 150; index += 1) {
        await ctx.db.insert("collections", {
          organizationId: setup.organizationId,
          accessionNumber: `F-${index}`,
          normalizedIdentifier: `f-${index}`,
          title: `Filler ${index}`,
          status: "active",
          catalogedBy: setup.userId,
          catalogedAt: Date.now(),
        });
      }
    });
    await insertObject(t, setup, {
      accessionNumber: "LATE-1",
      title: "Telescope",
      creator: "Dollond",
    });

    const suggestions = await asUser(t, setup).query(
      api.search.searchSuggestions,
      { organizationId: setup.organizationId, query: "dollond" },
    );

    expect(suggestions).toContain("Dollond");
  });
});
