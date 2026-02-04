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
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Performance Test Org",
      slug: `perf-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Performance User",
      email: `perf-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Admin Role",
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

/**
 * Seed large dataset of test collections for performance testing
 */
async function seedLargeDataset(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  count: number,
): Promise<Id<"collections">[]> {
  const collectionIds: Id<"collections">[] = [];

  // Sample data for variety
  const artists = [
    "Leonardo da Vinci",
    "Vincent van Gogh",
    "Pablo Picasso",
    "Claude Monet",
    "Rembrandt",
    "Michelangelo",
    "Johannes Vermeer",
    "Frida Kahlo",
    "Georgia O'Keeffe",
    "Jackson Pollock",
  ];

  const objectTypes = [
    "Painting",
    "Sculpture",
    "Drawing",
    "Print",
    "Photograph",
    "Ceramic",
    "Textile",
    "Furniture",
    "Jewelry",
    "Manuscript",
  ];

  const materials = [
    "Oil on canvas",
    "Acrylic",
    "Watercolor",
    "Bronze",
    "Marble",
    "Wood",
    "Silk",
    "Gold",
    "Silver",
    "Paper",
  ];

  const cultures = [
    "European",
    "American",
    "Asian",
    "African",
    "Middle Eastern",
    "Oceanic",
    "Latin American",
  ];

  const periods = [
    "Renaissance",
    "Baroque",
    "Romantic",
    "Modern",
    "Contemporary",
    "Ancient",
    "Medieval",
    "Victorian",
  ];

  // Create objects in batches for better performance
  const batchSize = 100;
  for (let i = 0; i < count; i += batchSize) {
    const batch = Math.min(batchSize, count - i);
    const batchPromises = [];

    for (let j = 0; j < batch; j++) {
      const idx = i + j;
      const artist = artists[idx % artists.length]!;
      const objectType = objectTypes[idx % objectTypes.length]!;
      const material = materials[idx % materials.length]!;
      const culture = cultures[idx % cultures.length]!;
      const period = periods[idx % periods.length]!;

      batchPromises.push(
        t.run(async (ctx) => {
          return await ctx.db.insert("collections", {
            organizationId,
            accessionNumber: `PERF-${String(idx + 1).padStart(6, "0")}`,
            title: `${objectType} ${idx + 1} by ${artist}`,
            objectName: objectType,
            objectType: objectType,
            creator: artist,
            materials: material,
            culture: culture,
            period: period,
            description: `A ${material} ${objectType.toLowerCase()} from the ${period} period, created by ${artist}. Part of the ${culture} collection. Item ${idx + 1} of ${count}.`,
            dateCreated: `${1500 + (idx % 500)}`,
            status: "active",
            catalogedBy: userId,
            catalogedAt:
              Date.now() -
              Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
          });
        }),
      );
    }

    const batchIds = await Promise.all(batchPromises);
    collectionIds.push(...batchIds);
  }

  return collectionIds;
}

describe("Search Performance with Large Dataset", () => {
  test("globalSearch performs under 500ms with 1000+ objects", async () => {
    // #given - org with 1000 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    const targetCount = 1000;
    await seedLargeDataset(t, organizationId, userId, targetCount);

    // Verify we created the expected number
    const totalCollections = await t.run(async (ctx) => {
      const collections = await ctx.db
        .query("collections")
        .filter((q) => q.eq(q.field("organizationId"), organizationId))
        .collect();
      return collections.length;
    });

    expect(totalCollections).toBe(targetCount);

    // #when - search with common term
    const authed = t.withIdentity({
      subject: `${userId}|perf-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "Painting",
    });
    const duration = Date.now() - startTime;

    // #then - verify performance
    expect(duration).toBeLessThan(500);
    expect(result).toBeDefined();
    expect(result.objects).toBeDefined();
    expect(Array.isArray(result.objects)).toBe(true);
  }, 30000); // 30s timeout for large dataset creation

  test("paginatedSearchCollections handles large result sets efficiently", async () => {
    // #given - org with 500 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await seedLargeDataset(t, organizationId, userId, 500);

    // #when - paginated search
    const authed = t.withIdentity({
      subject: `${userId}|paginated-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.search.paginatedSearchCollections, {
      organizationId,
      query: "by",
      paginationOpts: { cursor: null, numItems: 20 },
    });
    const duration = Date.now() - startTime;

    // #then - verify performance and structure
    expect(duration).toBeLessThan(500);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("isDone");
    expect(result).toHaveProperty("continueCursor");
    expect(Array.isArray(result.page)).toBe(true);
  }, 20000);

  test(
    "collections list with multiple filters performs under 500ms",
    async () => {
    // #given - org with 800 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await seedLargeDataset(t, organizationId, userId, 800);

    // #when - complex filter with multiple conditions
    const authed = t.withIdentity({
      subject: `${userId}|filter-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.collections.list, {
      organizationId,
      search: "van",
      objectType: "Painting",
      culture: "European",
      paginationOpts: { cursor: null, numItems: 20 },
    });
    const duration = Date.now() - startTime;

    // #then - verify performance
    expect(duration).toBeLessThan(500);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("page");
    expect(Array.isArray(result.page)).toBe(true);
    },
    25000,
  );

  test("searchSuggestions returns quickly with large dataset", async () => {
    // #given - org with 1000 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await seedLargeDataset(t, organizationId, userId, 1000);

    // #when - get search suggestions
    const authed = t.withIdentity({
      subject: `${userId}|suggestions-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.search.searchSuggestions, {
      organizationId,
      query: "Pa",
      limit: 10,
    });
    const duration = Date.now() - startTime;

    // #then - verify performance (suggestions should be very fast)
    expect(duration).toBeLessThan(200); // Even stricter for autocomplete
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  }, 30000);

  test("multiple concurrent searches maintain performance", async () => {
    // #given - org with 600 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await seedLargeDataset(t, organizationId, userId, 600);

    // #when - run multiple searches concurrently
    const authed = t.withIdentity({
      subject: `${userId}|concurrent-session`,
      issuer: "https://example.test",
    });

    const queries = ["Painting", "Sculpture", "Leonardo", "Modern", "European"];
    const startTime = Date.now();

    const results = await Promise.all(
      queries.map((query) =>
        authed.query(api.search.globalSearch, {
          organizationId,
          query,
        }),
      ),
    );

    const duration = Date.now() - startTime;

    // #then - verify all queries complete reasonably fast
    expect(duration).toBeLessThan(2000); // 5 queries in < 2s
    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.objects).toBeDefined();
    });
  }, 25000);

  test("search with status filtering performs well with large dataset", async () => {
    // #given - org with mixed status collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    // Create 500 active and seed some with different statuses
    await seedLargeDataset(t, organizationId, userId, 500);

    // Add some deaccessioned items
    await t.run(async (ctx) => {
      for (let i = 0; i < 50; i++) {
        await ctx.db.insert("collections", {
          organizationId,
          accessionNumber: `DEACC-${String(i + 1).padStart(4, "0")}`,
          title: `Deaccessioned Item ${i + 1}`,
          status: "deaccessioned",
          catalogedBy: userId,
          catalogedAt: Date.now(),
        });
      }
    });

    // #when - search (should exclude deaccessioned by default)
    const authed = t.withIdentity({
      subject: `${userId}|status-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "Item",
    });
    const duration = Date.now() - startTime;

    // #then - verify performance with status filtering
    expect(duration).toBeLessThan(500);
    expect(result).toBeDefined();
  }, 20000);
});

describe("Search Performance Stress Tests", () => {
  test("handles 2000+ objects within acceptable time", async () => {
    // #given - large org with 2000 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await seedLargeDataset(t, organizationId, userId, 2000);

    // #when
    const authed = t.withIdentity({
      subject: `${userId}|stress-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.search.globalSearch, {
      organizationId,
      query: "Modern",
    });
    const duration = Date.now() - startTime;

    // #then - should still be reasonable (allow up to 1s for 2000 objects)
    expect(duration).toBeLessThan(1000);
    expect(result).toBeDefined();
  }, 60000); // 60s timeout for large dataset

  test("collections list with layered filters performs under 500ms", async () => {
    // #given - org with 1000 collections
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestOrg(t, [
      "collections.read",
    ]);

    await seedLargeDataset(t, organizationId, userId, 1000);

    // #when - complex nested filter
    const authed = t.withIdentity({
      subject: `${userId}|nested-session`,
      issuer: "https://example.test",
    });

    const startTime = Date.now();
    const result = await authed.query(api.collections.list, {
      organizationId,
      search: "van",
      objectType: "Painting",
      materials: "canvas",
      period: "Modern",
      culture: "European",
      paginationOpts: { cursor: null, numItems: 50 },
    });
    const duration = Date.now() - startTime;

    // #then
    expect(duration).toBeLessThan(500);
    expect(result).toBeDefined();
    expect(result.page).toBeDefined();
  }, 35000);
});
