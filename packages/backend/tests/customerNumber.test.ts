import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  formatCustomerNumber,
  kindCodeForOrganizationType,
  parseCustomerNumber,
} from "../convex/utils/customerNumber";
import { authedForUser } from "./testHarness";
import { modules } from "./testSetup";

async function createUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Customer Number Admin",
      email: `customer-number-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
}

describe("customer number format and parse", () => {
  test("kindCodeForOrganizationType maps collector to 0100 and institutions to 0200", () => {
    expect(kindCodeForOrganizationType("collector")).toBe("0100");
    expect(kindCodeForOrganizationType("museum")).toBe("0200");
    expect(kindCodeForOrganizationType("gallery")).toBe("0200");
    expect(kindCodeForOrganizationType("library")).toBe("0200");
  });

  test("formatCustomerNumber writes kind plus six-digit sequence", () => {
    expect(formatCustomerNumber("0100", 100000)).toBe("0100100000");
    expect(formatCustomerNumber("0200", 100001)).toBe("0200100001");
    expect(formatCustomerNumber("0200", 999999)).toBe("0200999999");
  });

  test("formatCustomerNumber throws outside 100000 to 999999", () => {
    expect(() => formatCustomerNumber("0100", 99999)).toThrow();
    expect(() => formatCustomerNumber("0100", 1000000)).toThrow();
    expect(() => formatCustomerNumber("0100", 100000.5)).toThrow();
  });

  test("parseCustomerNumber accepts minted numbers and rejects ORG, ACC, and 0300", () => {
    expect(parseCustomerNumber("0100100000")).toBe("0100100000");
    expect(parseCustomerNumber("0200100001")).toBe("0200100001");
    expect(parseCustomerNumber("ORG-00001")).toBeNull();
    expect(parseCustomerNumber("ACC-00001")).toBeNull();
    expect(parseCustomerNumber("0300100000")).toBeNull();
    expect(parseCustomerNumber("0100000000")).toBeNull();
    expect(parseCustomerNumber("020010000")).toBeNull();
  });
});

describe("organizations.create customer numbers", () => {
  test("collector mints 0100100000 and a later museum mints 0200100001", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const collectorId = await authed.mutation(api.organizations.create, {
      name: "Private Collection",
      slug: `collector-${Math.random().toString(36).slice(2, 8)}`,
      type: "collector",
    });
    const museumId = await authed.mutation(api.organizations.create, {
      name: "City Museum",
      slug: `museum-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const [collector, museum] = await Promise.all([
      t.run(async (ctx) => ctx.db.get(collectorId)),
      t.run(async (ctx) => ctx.db.get(museumId)),
    ]);

    expect(collector?.customerNumber).toBe("0100100000");
    expect(museum?.customerNumber).toBe("0200100001");
    expect(collector?.accountNumber).toMatch(/^ORG-\d{5}$/);
    expect(museum?.accountNumber).toMatch(/^ORG-\d{5}$/);
  });

  test("update of the org name leaves customerNumber unchanged", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const organizationId = await authed.mutation(api.organizations.create, {
      name: "Original Name",
      slug: `rename-${Math.random().toString(36).slice(2, 8)}`,
      type: "gallery",
    });

    const before = await authed.query(api.organizations.get, {
      organizationId,
    });
    expect(before?.customerNumber).toBe("0200100000");

    await authed.mutation(api.organizations.update, {
      organizationId,
      name: "Renamed Gallery",
    });

    const after = await authed.query(api.organizations.get, {
      organizationId,
    });
    expect(after?.name).toBe("Renamed Gallery");
    expect(after?.customerNumber).toBe("0200100000");
  });
});

describe("getByCustomerNumber", () => {
  test("returns null for ORG-00001 and 0300100000", async () => {
    const t = convexTest(schema, modules);

    const [orgLookup, nonprofitLookup] = await Promise.all([
      t.query(internal.organizations.getByCustomerNumber, {
        customerNumber: "ORG-00001",
      }),
      t.query(internal.organizations.getByCustomerNumber, {
        customerNumber: "0300100000",
      }),
    ]);

    expect(orgLookup).toBeNull();
    expect(nonprofitLookup).toBeNull();
  });

  test("returns the organization id for a minted number", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const organizationId = await authed.mutation(api.organizations.create, {
      name: "Lookup Library",
      slug: `lookup-${Math.random().toString(36).slice(2, 8)}`,
      type: "library",
    });

    const match = await t.query(internal.organizations.getByCustomerNumber, {
      customerNumber: "0200100000",
    });

    expect(match).toEqual({
      organizationId,
      name: "Lookup Library",
      customerNumber: "0200100000",
    });
  });
});

describe("backfillCustomerNumbers", () => {
  test("assigns in _creationTime order and is idempotent without touching accountNumber", async () => {
    const t = convexTest(schema, modules);

    const firstId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Legacy Museum",
        slug: `legacy-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        accountNumber: "ORG-12345",
      });
    });
    const secondId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Legacy Collector",
        slug: `legacy-collector-${Math.random().toString(36).slice(2, 8)}`,
        type: "collector",
        accountNumber: "ORG-12346",
      });
    });

    const firstRun = await t.mutation(
      internal.migrations.backfillCustomerNumbers,
      {},
    );
    expect(firstRun).toEqual({
      totalOrganizations: 2,
      customerNumbersAssigned: 2,
      alreadyAssigned: 0,
    });

    const [afterFirst, afterSecond] = await Promise.all([
      t.run(async (ctx) => ctx.db.get(firstId)),
      t.run(async (ctx) => ctx.db.get(secondId)),
    ]);
    expect(afterFirst?.customerNumber).toBe("0200100000");
    expect(afterSecond?.customerNumber).toBe("0100100001");
    expect(afterFirst?.accountNumber).toBe("ORG-12345");
    expect(afterSecond?.accountNumber).toBe("ORG-12346");

    const secondRun = await t.mutation(
      internal.migrations.backfillCustomerNumbers,
      {},
    );
    expect(secondRun).toEqual({
      totalOrganizations: 2,
      customerNumbersAssigned: 0,
      alreadyAssigned: 2,
    });

    const [unchangedFirst, unchangedSecond] = await Promise.all([
      t.run(async (ctx) => ctx.db.get(firstId)),
      t.run(async (ctx) => ctx.db.get(secondId)),
    ]);
    expect(unchangedFirst?.customerNumber).toBe("0200100000");
    expect(unchangedSecond?.customerNumber).toBe("0100100001");
    expect(unchangedFirst?.accountNumber).toBe("ORG-12345");
    expect(unchangedSecond?.accountNumber).toBe("ORG-12346");
  });
});
