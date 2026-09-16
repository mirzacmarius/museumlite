// @vitest-environment edge-runtime
import { convexTest, type TestConvexForDataModel } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { DataModel, Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type TestClient = TestConvexForDataModel<DataModel>;

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
    return { owner, other, limitedUserId };
  });

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
  };
  const endpoints = {
    "donors:list": (client: TestClient) =>
      client.query(api.donors.list, organizationArgs),
    "donors:checkUsage": (client: TestClient) =>
      client.query(api.donors.checkUsage, { donorId: owner.donorId }),
    "donors:incrementUsage": (client: TestClient) =>
      client.mutation(api.donors.incrementUsage, { donorId: owner.donorId }),
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
    "materialOptions:incrementUsage": (client: TestClient) =>
      client.mutation(api.materialOptions.incrementUsage, {
        materialId: owner.materialId,
      }),
    "typeOptions:list": (client: TestClient) =>
      client.query(api.typeOptions.list, organizationArgs),
    "typeOptions:checkUsage": (client: TestClient) =>
      client.query(api.typeOptions.checkUsage, { typeId: owner.typeId }),
    "typeOptions:incrementUsage": (client: TestClient) =>
      client.mutation(api.typeOptions.incrementUsage, { typeId: owner.typeId }),
    "conditionOptions:list": (client: TestClient) =>
      client.query(api.conditionOptions.list, organizationArgs),
    "conditionOptions:checkUsage": (client: TestClient) =>
      client.query(api.conditionOptions.checkUsage, {
        conditionId: owner.conditionId,
      }),
    "conditionOptions:incrementUsage": (client: TestClient) =>
      client.mutation(api.conditionOptions.incrementUsage, {
        conditionId: owner.conditionId,
      }),
  };
  const counterIds = {
    "donors:incrementUsage": owner.donorId,
    "accessionTemplates:incrementUsage": owner.templateId,
    "materialOptions:incrementUsage": owner.materialId,
    "typeOptions:incrementUsage": owner.typeId,
    "conditionOptions:incrementUsage": owner.conditionId,
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

  return {
    t,
    endpoints,
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

const endpointNames = [
  "donors:list",
  "donors:checkUsage",
  "donors:incrementUsage",
  "accessionTemplates:list",
  "accessionTemplates:incrementUsage",
  "materialOptions:list",
  "materialOptions:checkUsage",
  "materialOptions:incrementUsage",
  "typeOptions:list",
  "typeOptions:checkUsage",
  "typeOptions:incrementUsage",
  "conditionOptions:list",
  "conditionOptions:checkUsage",
  "conditionOptions:incrementUsage",
] as const;

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
