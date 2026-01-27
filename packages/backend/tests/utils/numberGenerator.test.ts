/**
 * Test file for Number Generator Utility
 *
 * Tests atomic counter incrementation for various counter tables.
 * Covers year-based counters (loans, transit, claims) and global counters (accounts).
 *
 * Run with: `bun test numberGenerator.test.ts` (from packages/backend)
 */

import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";
import {
  getNextYearBasedValue,
  getNextGlobalValue,
  getCurrentYear,
  padNumber,
} from "../../convex/utils/numberGenerator";

import { modules } from "../testSetup";

describe("Pure utility functions", () => {
  test("getCurrentYear should return current year", () => {
    const year = getCurrentYear();
    const expectedYear = new Date().getFullYear();
    expect(year).toBe(expectedYear);
  });

  test("padNumber should pad with leading zeros", () => {
    expect(padNumber(1, 4)).toBe("0001");
    expect(padNumber(42, 4)).toBe("0042");
    expect(padNumber(123, 4)).toBe("0123");
    expect(padNumber(9999, 4)).toBe("9999");
  });

  test("padNumber should handle different lengths", () => {
    expect(padNumber(1, 2)).toBe("01");
    expect(padNumber(1, 3)).toBe("001");
    expect(padNumber(1, 5)).toBe("00001");
  });

  test("padNumber should not truncate numbers larger than padding", () => {
    expect(padNumber(12345, 3)).toBe("12345");
    expect(padNumber(999, 2)).toBe("999");
  });
});

describe("Year-based counters", () => {
  test("should create new loanCounter and start at 1", async () => {
    const t = convexTest(schema, modules);

    // Create test organization
    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Get next value (should create counter at 1)
    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "loanCounters",
        organizationId: orgId,
        year: 2026,
      });
    });

    expect(nextValue).toBe(1);

    // Verify counter was created
    const counter = await t.run(async (ctx) => {
      return await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();
    });

    expect(counter).toBeDefined();
    expect(counter?.currentValue).toBe(1);
    expect(counter?.year).toBe(2026);
  });

  test("should increment existing loanCounter", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Create initial counter
    await t.run(async (ctx) => {
      await ctx.db.insert("loanCounters", {
        organizationId: orgId,
        year: 2026,
        currentValue: 5,
        lastGeneratedAt: Date.now(),
      });
    });

    // Get next value (should increment to 6)
    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "loanCounters",
        organizationId: orgId,
        year: 2026,
      });
    });

    expect(nextValue).toBe(6);

    // Verify counter was updated
    const counter = await t.run(async (ctx) => {
      return await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();
    });

    expect(counter?.currentValue).toBe(6);
  });

  test("should handle multiple increments atomically", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Get three sequential values
    const values: number[] = [];
    for (let i = 0; i < 3; i++) {
      const value = await t.run(async (ctx) => {
        const counter = await ctx.db
          .query("loanCounters")
          .withIndex("by_organization_and_year", (q) =>
            q.eq("organizationId", orgId).eq("year", 2026),
          )
          .first();

        return await getNextYearBasedValue(ctx, counter, {
          tableName: "loanCounters",
          organizationId: orgId,
          year: 2026,
        });
      });
      values.push(value);
    }

    // Verify sequential values
    expect(values).toEqual([1, 2, 3]);
  });

  test("should work with transitCounters", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("transitCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "transitCounters",
        organizationId: orgId,
        year: 2026,
      });
    });

    expect(nextValue).toBe(1);
  });

  test("should work with claimCounters", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("claimCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "claimCounters",
        organizationId: orgId,
        year: 2026,
      });
    });

    expect(nextValue).toBe(1);
  });

  test("should isolate counters by year", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Create counter for 2025 at value 10
    await t.run(async (ctx) => {
      await ctx.db.insert("loanCounters", {
        organizationId: orgId,
        year: 2025,
        currentValue: 10,
        lastGeneratedAt: Date.now(),
      });
    });

    // Get next value for 2026 (should start at 1, not 11)
    const nextValue2026 = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "loanCounters",
        organizationId: orgId,
        year: 2026,
      });
    });

    expect(nextValue2026).toBe(1);

    // Verify 2025 counter unchanged
    const counter2025 = await t.run(async (ctx) => {
      return await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", orgId).eq("year", 2025),
        )
        .first();
    });

    expect(counter2025?.currentValue).toBe(10);
  });
});

describe("Global counters", () => {
  test("should create new accountCounter and start at 1", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .first();

      return await getNextGlobalValue(ctx, counter, {
        tableName: "accountCounters",
        organizationId: orgId,
      });
    });

    expect(nextValue).toBe(1);

    // Verify counter was created
    const counter = await t.run(async (ctx) => {
      return await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .first();
    });

    expect(counter).toBeDefined();
    expect(counter?.currentValue).toBe(1);
  });

  test("should increment existing accountCounter", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Create initial counter
    await t.run(async (ctx) => {
      await ctx.db.insert("accountCounters", {
        organizationId: orgId,
        currentValue: 100,
        lastGeneratedAt: Date.now(),
      });
    });

    // Get next value (should increment to 101)
    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .first();

      return await getNextGlobalValue(ctx, counter, {
        tableName: "accountCounters",
        organizationId: orgId,
      });
    });

    expect(nextValue).toBe(101);

    // Verify counter was updated
    const counter = await t.run(async (ctx) => {
      return await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .first();
    });

    expect(counter?.currentValue).toBe(101);
  });

  test("should handle multiple increments atomically", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Get five sequential values
    const values: number[] = [];
    for (let i = 0; i < 5; i++) {
      const value = await t.run(async (ctx) => {
        const counter = await ctx.db
          .query("accountCounters")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .first();

        return await getNextGlobalValue(ctx, counter, {
          tableName: "accountCounters",
          organizationId: orgId,
        });
      });
      values.push(value);
    }

    // Verify sequential values
    expect(values).toEqual([1, 2, 3, 4, 5]);
  });

  test("should persist across years (global scope)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {},
      });
    });

    // Create counter at value 50
    await t.run(async (ctx) => {
      await ctx.db.insert("accountCounters", {
        organizationId: orgId,
        currentValue: 50,
        lastGeneratedAt: Date.now(),
      });
    });

    // Get next value - should continue from 50 (not reset)
    const nextValue = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .first();

      return await getNextGlobalValue(ctx, counter, {
        tableName: "accountCounters",
        organizationId: orgId,
      });
    });

    expect(nextValue).toBe(51);
  });
});

describe("Organization isolation", () => {
  test("should isolate year-based counters by organization", async () => {
    const t = convexTest(schema, modules);

    // Create two organizations
    const org1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Org 1",
        slug: "org-1",
        type: "museum",
        settings: {},
      });
    });

    const org2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Org 2",
        slug: "org-2",
        type: "museum",
        settings: {},
      });
    });

    // Get values for both organizations
    const value1 = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", org1Id).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "loanCounters",
        organizationId: org1Id,
        year: 2026,
      });
    });

    const value2 = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("loanCounters")
        .withIndex("by_organization_and_year", (q) =>
          q.eq("organizationId", org2Id).eq("year", 2026),
        )
        .first();

      return await getNextYearBasedValue(ctx, counter, {
        tableName: "loanCounters",
        organizationId: org2Id,
        year: 2026,
      });
    });

    // Both should start at 1 independently
    expect(value1).toBe(1);
    expect(value2).toBe(1);
  });

  test("should isolate global counters by organization", async () => {
    const t = convexTest(schema, modules);

    // Create two organizations
    const org1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Org 1",
        slug: "org-1",
        type: "museum",
        settings: {},
      });
    });

    const org2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Org 2",
        slug: "org-2",
        type: "museum",
        settings: {},
      });
    });

    // Get values for both organizations
    const value1 = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", org1Id))
        .first();

      return await getNextGlobalValue(ctx, counter, {
        tableName: "accountCounters",
        organizationId: org1Id,
      });
    });

    const value2 = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("accountCounters")
        .withIndex("by_organization", (q) => q.eq("organizationId", org2Id))
        .first();

      return await getNextGlobalValue(ctx, counter, {
        tableName: "accountCounters",
        organizationId: org2Id,
      });
    });

    // Both should start at 1 independently
    expect(value1).toBe(1);
    expect(value2).toBe(1);
  });
});
