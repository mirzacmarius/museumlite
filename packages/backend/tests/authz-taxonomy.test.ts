// @vitest-environment edge-runtime
import { convexTest, type TestConvexForDataModel } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { DataModel, Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type TestClient = TestConvexForDataModel<DataModel>;

async function completeUsageBackfill(
  t: TestClient,
  organizationId: Id<"organizations">,
) {
  let cursor: string | null = null;
  for (;;) {
    const page = await t.mutation(
      internal.utils.collectionOptionUsages.backfillPage,
      { organizationId, cursor },
    );
    if (page.isDone) return;
    cursor = page.continueCursor;
  }
}

async function setup() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const readPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
    });
    const updatePermissionId = await ctx.db.insert("permissions", {
      name: "collections.update",
      category: "collections",
    });

    async function createOrganization(slug: string) {
      const organizationId = await ctx.db.insert("organizations", {
        name: slug,
        slug,
        type: "museum",
      });
      const userId = await ctx.db.insert("users", {
        name: slug,
        email: `${slug}@example.test`,
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Catalog editor",
        isSystemRole: false,
      });
      for (const permissionId of [readPermissionId, updatePermissionId]) {
        await ctx.db.insert("rolePermissions", { roleId, permissionId });
      }
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId,
        joinedAt: 1,
      });
      const common = {
        organizationId,
        name: "Shared name",
        createdBy: userId,
        createdAt: 1,
        usageCount: 0,
      };
      const donorId = await ctx.db.insert("donors", {
        ...common,
        email: `${slug}-donor@example.test`,
        phone: "1234",
        address: `${slug} private address`,
        notes: `${slug} private notes`,
      });
      const templateId = await ctx.db.insert("accessionTemplates", {
        ...common,
        template: "{YEAR}.{COUNTER}",
        isDefault: false,
      });
      const materialId = await ctx.db.insert("materialOptions", common);
      const typeId = await ctx.db.insert("typeOptions", common);
      const conditionId = await ctx.db.insert("conditionOptions", {
        ...common,
        description: "Shared description",
      });
      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `${slug}-001`,
        title: `${slug} private object`,
        donated_by: [common.name],
        materials: common.name,
        objectType: common.name,
        condition: common.name,
        status: "active",
        catalogedBy: userId,
        catalogedAt: 1,
      });
      return {
        organizationId,
        userId,
        donorId,
        templateId,
        materialId,
        typeId,
        conditionId,
      };
    }

    const owner = await createOrganization("owner");
    const other = await createOrganization("other");
    const missingCommon = {
      organizationId: owner.organizationId,
      name: "Missing name",
      createdBy: owner.userId,
      createdAt: 1,
      usageCount: 0,
    };
    const missingDonorId = await ctx.db.insert("donors", {
      ...missingCommon,
      email: "missing-donor@example.test",
      phone: "0000",
      address: "gone",
      notes: "gone",
    });
    const missingTemplateId = await ctx.db.insert("accessionTemplates", {
      ...missingCommon,
      template: "{YEAR}.{COUNTER}",
      isDefault: false,
    });
    const missingMaterialId = await ctx.db.insert(
      "materialOptions",
      missingCommon,
    );
    const missingTypeId = await ctx.db.insert("typeOptions", missingCommon);
    const missingConditionId = await ctx.db.insert("conditionOptions", {
      ...missingCommon,
      description: "gone",
    });
    await Promise.all([
      ctx.db.delete(missingDonorId),
      ctx.db.delete(missingTemplateId),
      ctx.db.delete(missingMaterialId),
      ctx.db.delete(missingTypeId),
      ctx.db.delete(missingConditionId),
    ]);
    const limitedUserId = await ctx.db.insert("users", {
      name: "Member without catalog permissions",
    });
    const limitedRoleId = await ctx.db.insert("roles", {
      organizationId: owner.organizationId,
      name: "No catalog access",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId: limitedUserId,
      organizationId: owner.organizationId,
      roleId: limitedRoleId,
      joinedAt: 1,
    });
    return {
      owner,
      other,
      limitedUserId,
      missing: {
        donorId: missingDonorId,
        templateId: missingTemplateId,
        materialId: missingMaterialId,
        typeId: missingTypeId,
        conditionId: missingConditionId,
      },
    };
  });

  await completeUsageBackfill(t, data.owner.organizationId);
  await completeUsageBackfill(t, data.other.organizationId);

  const identity = (userId: Id<"users">) =>
    t.withIdentity({
      subject: `${userId}|session`,
      issuer: "https://example.test",
    });
  const { owner } = data;
  const organizationArgs = { organizationId: owner.organizationId };
  const usageResult = {
    isUsed: true,
    usageCount: 1,
    collectionNames: ["owner-001"],
    truncatedNames: false,
  };
  const unusedUsage = {
    isUsed: false,
    usageCount: 0,
    collectionNames: [] as string[],
    truncatedNames: false,
  };
  const endpoints = {
    "donors:list": (client: TestClient) =>
      client.query(api.donors.list, organizationArgs),
    "donors:checkUsage": (client: TestClient) =>
      client.query(api.donors.checkUsage, { donorId: owner.donorId }),
    "accessionTemplates:list": (client: TestClient) =>
      client.query(api.accessionTemplates.list, organizationArgs),
    "accessionTemplates:incrementUsage": (client: TestClient) =>
      client.mutation(api.accessionTemplates.incrementUsage, {
        templateId: owner.templateId,
      }),
    "materialOptions:list": (client: TestClient) =>
      client.query(api.materialOptions.list, organizationArgs),
    "materialOptions:checkUsage": (client: TestClient) =>
      client.query(api.materialOptions.checkUsage, {
        materialId: owner.materialId,
      }),
    "typeOptions:list": (client: TestClient) =>
      client.query(api.typeOptions.list, organizationArgs),
    "typeOptions:checkUsage": (client: TestClient) =>
      client.query(api.typeOptions.checkUsage, { typeId: owner.typeId }),
    "conditionOptions:list": (client: TestClient) =>
      client.query(api.conditionOptions.list, organizationArgs),
    "conditionOptions:checkUsage": (client: TestClient) =>
      client.query(api.conditionOptions.checkUsage, {
        conditionId: owner.conditionId,
      }),
  };
  const counterIds = {
    "accessionTemplates:incrementUsage": owner.templateId,
  };
  const readCounters = () =>
    t.run(async (ctx) =>
      Promise.all(
        Object.values(counterIds).map(async (id) => {
          const doc = await ctx.db.get(id);
          return {
            id,
            usageCount: doc?.usageCount,
            lastUsedAt: doc?.lastUsedAt,
          };
        }),
      ),
    );

  const oracles = [
    {
      name: "donors:checkUsage" as const,
      sentinel: unusedUsage,
      live: (client: TestClient) =>
        client.query(api.donors.checkUsage, { donorId: owner.donorId }),
      missing: (client: TestClient) =>
        client.query(api.donors.checkUsage, {
          donorId: data.missing.donorId,
        }),
    },
    {
      name: "accessionTemplates:incrementUsage" as const,
      sentinel: null,
      live: (client: TestClient) =>
        client.mutation(api.accessionTemplates.incrementUsage, {
          templateId: owner.templateId,
        }),
      missing: (client: TestClient) =>
        client.mutation(api.accessionTemplates.incrementUsage, {
          templateId: data.missing.templateId,
        }),
    },
    {
      name: "materialOptions:checkUsage" as const,
      sentinel: unusedUsage,
      live: (client: TestClient) =>
        client.query(api.materialOptions.checkUsage, {
          materialId: owner.materialId,
        }),
      missing: (client: TestClient) =>
        client.query(api.materialOptions.checkUsage, {
          materialId: data.missing.materialId,
        }),
    },
    {
      name: "typeOptions:checkUsage" as const,
      sentinel: unusedUsage,
      live: (client: TestClient) =>
        client.query(api.typeOptions.checkUsage, { typeId: owner.typeId }),
      missing: (client: TestClient) =>
        client.query(api.typeOptions.checkUsage, {
          typeId: data.missing.typeId,
        }),
    },
    {
      name: "conditionOptions:checkUsage" as const,
      sentinel: unusedUsage,
      live: (client: TestClient) =>
        client.query(api.conditionOptions.checkUsage, {
          conditionId: owner.conditionId,
        }),
      missing: (client: TestClient) =>
        client.query(api.conditionOptions.checkUsage, {
          conditionId: data.missing.conditionId,
        }),
    },
  ];

  return {
    t,
    endpoints,
    oracles,
    counterIds,
    readCounters,
    usageResult,
    organizationId: owner.organizationId,
    clients: {
      owner: identity(owner.userId),
      insufficient: identity(data.limitedUserId),
      crossOrganization: identity(data.other.userId),
      anonymous: t,
    },
  };
}

const listEndpointNames = [
  "donors:list",
  "accessionTemplates:list",
  "materialOptions:list",
  "typeOptions:list",
  "conditionOptions:list",
] as const;

const oracleEndpointNames = [
  "donors:checkUsage",
  "accessionTemplates:incrementUsage",
  "materialOptions:checkUsage",
  "typeOptions:checkUsage",
  "conditionOptions:checkUsage",
] as const;

const endpointNames = [...listEndpointNames, ...oracleEndpointNames] as const;

describe.each(endpointNames)("%s authorization", (name) => {
  test("allows the authorized member and keeps results inside their organization", async () => {
    const fixture = await setup();
    const result = await fixture.endpoints[name](fixture.clients.owner);
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        organizationId: fixture.organizationId,
      });
    } else if (result !== null) {
      expect(result).toEqual(fixture.usageResult);
    } else {
      const counters = await fixture.readCounters();
      expect(
        counters.filter((counter) => counter.usageCount === 1),
      ).toHaveLength(1);
      const changedCounter = counters.find(
        (counter) => counter.usageCount === 1,
      );
      const expectedId = Object.entries(fixture.counterIds).find(
        ([endpoint]) => endpoint === name,
      )?.[1];
      expect(changedCounter?.id).toBe(expectedId);
      expect(changedCounter?.lastUsedAt).toEqual(expect.any(Number));
    }
  });
});

describe.each(listEndpointNames)("%s authorization", (name) => {
  test.each([
    "insufficient",
    "crossOrganization",
    "anonymous",
  ] as const)("refuses the %s caller without modifying counters", async (caller) => {
    const fixture = await setup();
    const before = await fixture.readCounters();
    await expect(
      fixture.endpoints[name](fixture.clients[caller]),
    ).rejects.toThrow("Permission denied:");
    expect(await fixture.readCounters()).toEqual(before);
  });
});

describe.each(oracleEndpointNames)("%s existence oracle", (name) => {
  test("denies an anonymous caller on a missing id", async () => {
    const fixture = await setup();
    const oracle = fixture.oracles.find((entry) => entry.name === name);
    if (!oracle) throw new Error(`Missing oracle ${name}`);
    await expect(oracle.missing(fixture.clients.anonymous)).rejects.toThrow(
      "Not authenticated",
    );
  });

  test("returns the same sentinel for a member miss and a foreign live id", async () => {
    const fixture = await setup();
    const oracle = fixture.oracles.find((entry) => entry.name === name);
    if (!oracle) throw new Error(`Missing oracle ${name}`);
    const memberMiss = await oracle.missing(fixture.clients.owner);
    const foreignLive = await oracle.live(fixture.clients.crossOrganization);
    expect(memberMiss).toEqual(oracle.sentinel);
    expect(foreignLive).toEqual(memberMiss);
  });

  test.each([
    "insufficient",
    "crossOrganization",
    "anonymous",
  ] as const)("does not modify counters for the %s caller on a live id", async (caller) => {
    const fixture = await setup();
    const oracle = fixture.oracles.find((entry) => entry.name === name);
    if (!oracle) throw new Error(`Missing oracle ${name}`);
    const before = await fixture.readCounters();
    if (caller === "anonymous") {
      await expect(oracle.live(fixture.clients.anonymous)).rejects.toThrow(
        "Not authenticated",
      );
    } else {
      expect(await oracle.live(fixture.clients[caller])).toEqual(
        oracle.sentinel,
      );
    }
    expect(await fixture.readCounters()).toEqual(before);
  });
});

async function occupancySetup() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const readPermissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
    });
    const updatePermissionId = await ctx.db.insert("permissions", {
      name: "collections.update",
      category: "collections",
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "usage-org",
      slug: "usage-org",
      type: "museum",
    });
    const userId = await ctx.db.insert("users", {
      name: "usage-user",
      email: "usage@example.test",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Catalog editor",
      isSystemRole: false,
    });
    for (const permissionId of [readPermissionId, updatePermissionId]) {
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: 1,
    });
    const common = {
      organizationId,
      createdBy: userId,
      createdAt: 1,
      usageCount: 0,
    };
    const oakId = await ctx.db.insert("materialOptions", {
      ...common,
      name: "Oak",
    });
    const bronzeId = await ctx.db.insert("materialOptions", {
      ...common,
      name: "Bronze",
    });
    const goodId = await ctx.db.insert("conditionOptions", {
      ...common,
      name: "Good",
      description: "ok",
    });
    return { organizationId, userId, oakId, bronzeId, goodId };
  });
  const owner = t.withIdentity({
    subject: `${data.userId}|session`,
    issuer: "https://example.test",
  });
  return { t, owner, ...data };
}

async function occupancyRowCount(
  t: TestClient,
  collectionId: Id<"collections">,
) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("collectionOptionUsages")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    return rows.length;
  });
}

describe("option usage occupancy", () => {
  test("JSON-array materials found by each value", async () => {
    const fixture = await occupancySetup();
    await fixture.t.run(async (ctx) => {
      await ctx.db.insert("collections", {
        organizationId: fixture.organizationId,
        accessionNumber: "MAT-1",
        title: "Materials object",
        materials: JSON.stringify(["Oak", "Bronze"]),
        status: "active",
        catalogedBy: fixture.userId,
        catalogedAt: 1,
      });
    });
    await completeUsageBackfill(fixture.t, fixture.organizationId);

    expect(
      await fixture.owner.query(api.materialOptions.checkUsage, {
        materialId: fixture.oakId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 1,
      collectionNames: ["MAT-1"],
      truncatedNames: false,
    });
    expect(
      await fixture.owner.query(api.materialOptions.checkUsage, {
        materialId: fixture.bronzeId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 1,
      collectionNames: ["MAT-1"],
      truncatedNames: false,
    });
  });

  test("case-variant option name matches", async () => {
    const fixture = await occupancySetup();
    await fixture.t.run(async (ctx) => {
      await ctx.db.insert("collections", {
        organizationId: fixture.organizationId,
        accessionNumber: "CASE-1",
        title: "Case variant",
        condition: "GOOD",
        status: "active",
        catalogedBy: fixture.userId,
        catalogedAt: 1,
      });
    });
    await completeUsageBackfill(fixture.t, fixture.organizationId);

    expect(
      await fixture.owner.query(api.conditionOptions.checkUsage, {
        conditionId: fixture.goodId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 1,
      collectionNames: ["CASE-1"],
      truncatedNames: false,
    });
  });

  test("sync-twice is idempotent", async () => {
    const fixture = await occupancySetup();
    const collectionId = await fixture.t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId: fixture.organizationId,
        accessionNumber: "SYNC-1",
        title: "Sync twice",
        materials: JSON.stringify(["Oak", "Bronze"]),
        status: "active",
        catalogedBy: fixture.userId,
        catalogedAt: 1,
      });
    });
    await completeUsageBackfill(fixture.t, fixture.organizationId);
    expect(await occupancyRowCount(fixture.t, collectionId)).toBe(2);

    await fixture.owner.mutation(api.collections.update, {
      collectionId,
      materials: JSON.stringify(["Oak", "Bronze"]),
    });
    await fixture.owner.mutation(api.collections.update, {
      collectionId,
      materials: JSON.stringify(["Oak", "Bronze"]),
    });

    expect(await occupancyRowCount(fixture.t, collectionId)).toBe(2);
    expect(
      await fixture.owner.query(api.materialOptions.checkUsage, {
        materialId: fixture.oakId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 1,
      collectionNames: ["SYNC-1"],
      truncatedNames: false,
    });
  });

  test("pre-existing org throws until occupancy backfill completes", async () => {
    const fixture = await occupancySetup();
    await fixture.t.run(async (ctx) => {
      await ctx.db.insert("collections", {
        organizationId: fixture.organizationId,
        accessionNumber: "LEGACY-1",
        title: "Legacy object",
        condition: "Good",
        status: "active",
        catalogedBy: fixture.userId,
        catalogedAt: 1,
      });
      await ctx.db.insert("collectionOptionUsageBackfills", {
        organizationId: fixture.organizationId,
        completedAt: 1,
      });
    });

    await fixture.t.run(async (ctx) => {
      const flag = await ctx.db
        .query("collectionOptionUsageBackfills")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", fixture.organizationId),
        )
        .unique();
      if (!flag) {
        throw new Error("expected occupancy backfill flag after setup");
      }
      await ctx.db.delete(flag._id);
    });

    await expect(
      fixture.owner.query(api.conditionOptions.checkUsage, {
        conditionId: fixture.goodId,
      }),
    ).rejects.toThrow("Usage index is backfilling");

    let cursor: string | null = null;
    for (;;) {
      const page = await fixture.t.mutation(
        internal.migrations.backfillCollectionOptionUsages,
        { organizationId: fixture.organizationId, cursor },
      );
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    expect(
      await fixture.owner.query(api.conditionOptions.checkUsage, {
        conditionId: fixture.goodId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 1,
      collectionNames: ["LEGACY-1"],
      truncatedNames: false,
    });
  });

  test("backfill then checkUsage", async () => {
    const fixture = await occupancySetup();
    await fixture.t.run(async (ctx) => {
      await ctx.db.insert("collections", {
        organizationId: fixture.organizationId,
        accessionNumber: "BF-1",
        title: "Backfill object",
        condition: "Good",
        status: "active",
        catalogedBy: fixture.userId,
        catalogedAt: 1,
      });
    });

    await expect(
      fixture.owner.query(api.conditionOptions.checkUsage, {
        conditionId: fixture.goodId,
      }),
    ).rejects.toThrow("Usage index is backfilling");

    await completeUsageBackfill(fixture.t, fixture.organizationId);

    expect(
      await fixture.owner.query(api.conditionOptions.checkUsage, {
        conditionId: fixture.goodId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 1,
      collectionNames: ["BF-1"],
      truncatedNames: false,
    });
  });

  test("truncatedNames is true at 21 usages", async () => {
    const fixture = await occupancySetup();
    await fixture.t.run(async (ctx) => {
      for (let index = 1; index <= 21; index += 1) {
        await ctx.db.insert("collections", {
          organizationId: fixture.organizationId,
          accessionNumber: `T-${String(index).padStart(2, "0")}`,
          title: `Truncation ${index}`,
          condition: "Good",
          status: "active",
          catalogedBy: fixture.userId,
          catalogedAt: index,
        });
      }
    });
    await completeUsageBackfill(fixture.t, fixture.organizationId);

    expect(
      await fixture.owner.query(api.conditionOptions.checkUsage, {
        conditionId: fixture.goodId,
      }),
    ).toEqual({
      isUsed: true,
      usageCount: 21,
      collectionNames: [
        "T-01",
        "T-02",
        "T-03",
        "T-04",
        "T-05",
        "T-06",
        "T-07",
        "T-08",
        "T-09",
        "T-10",
        "T-11",
        "T-12",
        "T-13",
        "T-14",
        "T-15",
        "T-16",
        "T-17",
        "T-18",
        "T-19",
        "T-20",
      ],
      truncatedNames: true,
    });
  });
});
