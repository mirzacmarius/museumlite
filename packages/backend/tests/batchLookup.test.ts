import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";
import {
  batchGetByIds,
  batchLookup,
  createLookupMap,
} from "../convex/utils/batchLookup";

import { modules } from "./testSetup";

test("batchGetByIds should fetch multiple documents", async () => {
  const t = convexTest(schema, modules);

  // Create test organizations
  const org1Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum 1",
      slug: "test-museum-1",
      type: "museum",
    });
  });

  const org2Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum 2",
      slug: "test-museum-2",
      type: "gallery",
    });
  });

  // Fetch documents using batchGetByIds
  const results = await t.run(async (ctx) => {
    return await batchGetByIds(ctx, [org1Id, org2Id], "organizations");
  });

  expect(results).toHaveLength(2);
  expect(results[0]).not.toBeNull();
  expect(results[1]).not.toBeNull();
  expect(results[0]?._id).toBe(org1Id);
  expect(results[1]?._id).toBe(org2Id);
  expect(results[0]?.name).toBe("Test Museum 1");
  expect(results[1]?.name).toBe("Test Museum 2");
});

test("batchGetByIds should deduplicate IDs", async () => {
  const t = convexTest(schema, modules);

  // Create test organization
  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum",
      type: "museum",
    });
  });

  // Fetch with duplicate IDs
  const results = await t.run(async (ctx) => {
    return await batchGetByIds(ctx, [orgId, orgId, orgId], "organizations");
  });

  // Should only fetch once despite 3 duplicate IDs
  expect(results).toHaveLength(1);
  expect(results[0]?._id).toBe(orgId);
  expect(results[0]?.name).toBe("Test Museum");
});

test("batchGetByIds should return null for non-existent IDs", async () => {
  const t = convexTest(schema, modules);

  // Create one real organization
  const realOrgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Real Museum",
      slug: "real-museum",
      type: "museum",
    });
  });

  // Create a fake ID that doesn't exist
  const fakeOrgId = "jd7abc123456789012345678" as Id<"organizations">;

  // Fetch with mix of real and fake IDs
  const results = await t.run(async (ctx) => {
    return await batchGetByIds(ctx, [realOrgId, fakeOrgId], "organizations");
  });

  expect(results).toHaveLength(2);
  expect(results[0]).not.toBeNull();
  expect(results[0]?._id).toBe(realOrgId);
  expect(results[1]).toBeNull();
});

test("batchGetByIds should handle empty array", async () => {
  const t = convexTest(schema, modules);

  const results = await t.run(async (ctx) => {
    return await batchGetByIds(ctx, [], "organizations");
  });

  expect(results).toHaveLength(0);
});

test("createLookupMap should create map from documents", async () => {
  const t = convexTest(schema, modules);

  // Create test organizations
  const org1Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Museum 1",
      slug: "museum-1",
      type: "museum",
    });
  });

  const org2Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Museum 2",
      slug: "museum-2",
      type: "gallery",
    });
  });

  // Fetch documents and create lookup map (perform all assertions inside t.run)
  await t.run(async (ctx) => {
    const docs = await batchGetByIds(ctx, [org1Id, org2Id], "organizations");
    const lookupMap = createLookupMap(docs);

    expect(lookupMap.size).toBe(2);
    expect(lookupMap.has(org1Id)).toBe(true);
    expect(lookupMap.has(org2Id)).toBe(true);
    expect(lookupMap.get(org1Id)?.name).toBe("Museum 1");
    expect(lookupMap.get(org2Id)?.name).toBe("Museum 2");
  });
});

test("createLookupMap should handle null values", async () => {
  const t = convexTest(schema, modules);

  // Create one real organization
  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Real Museum",
      slug: "real-museum",
      type: "museum",
    });
  });

  const org = await t.run(async (ctx) => {
    return await ctx.db.get(orgId);
  });

  // Create map with null values mixed in
  const lookupMap = createLookupMap([org, null, null]);

  expect(lookupMap.size).toBe(1);
  expect(lookupMap.has(orgId)).toBe(true);
  expect(lookupMap.get(orgId)?.name).toBe("Real Museum");
});

test("createLookupMap should handle empty array", async () => {
  const lookupMap = createLookupMap([]);

  expect(lookupMap.size).toBe(0);
});

test("batchLookup should combine fetch and map creation", async () => {
  const t = convexTest(schema, modules);

  // Create test organizations
  const org1Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Gallery A",
      slug: "gallery-a",
      type: "gallery",
    });
  });

  const org2Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Gallery B",
      slug: "gallery-b",
      type: "gallery",
    });
  });

  const org3Id = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Gallery C",
      slug: "gallery-c",
      type: "gallery",
    });
  });

  // Use convenience function (perform all assertions inside t.run)
  await t.run(async (ctx) => {
    const lookupMap = await batchLookup(
      ctx,
      [org1Id, org2Id, org3Id],
      "organizations",
    );

    expect(lookupMap.size).toBe(3);
    expect(lookupMap.get(org1Id)?.name).toBe("Gallery A");
    expect(lookupMap.get(org2Id)?.name).toBe("Gallery B");
    expect(lookupMap.get(org3Id)?.name).toBe("Gallery C");
  });
});

test("batchLookup should handle duplicates and non-existent IDs", async () => {
  const t = convexTest(schema, modules);

  // Create test organization
  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Collector",
      slug: "collector",
      type: "collector",
    });
  });

  // Create a fake ID
  const fakeOrgId = "jd7xyz987654321098765432" as Id<"organizations">;

  // Use with duplicates and non-existent ID (perform all assertions inside t.run)
  await t.run(async (ctx) => {
    const lookupMap = await batchLookup(
      ctx,
      [orgId, orgId, fakeOrgId],
      "organizations",
    );

    // Should only have one entry (duplicates removed, fake ID returns null which is filtered)
    expect(lookupMap.size).toBe(1);
    expect(lookupMap.has(orgId)).toBe(true);
    expect(lookupMap.has(fakeOrgId)).toBe(false);
    expect(lookupMap.get(orgId)?.name).toBe("Collector");
  });
});

test("batchLookup should handle empty array", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const lookupMap = await batchLookup(ctx, [], "organizations");
    expect(lookupMap.size).toBe(0);
  });
});
