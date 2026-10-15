import { expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SUPER_ADMIN_ROLE_NAME } from "../convex/utils/superAdmins";
import {
  ADMIN_ROLE_NAME,
  CATALOGER_ROLE_NAME,
  COLLECTION_MANAGER_ROLE_NAME,
  CURATOR_ROLE_NAME,
  LEGACY_REGISTRAR_ROLE_NAME,
  SYSTEM_ROLE_DEFINITIONS,
  VIEWER_ROLE_NAME,
} from "../convex/utils/systemRoles";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
} from "./testHarness";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 15, 12);

const appraisal = {
  appraisalDate: NOW - 30 * DAY,
  appraiserName: "Independent Valuer",
  appraisalType: "insurance" as const,
  value: 10_000,
  currency: "EUR",
};

async function seededMuseum(t: ConvexTest) {
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Owner", email: "owner@museum.test" }),
  );
  const owner = authedForUser(t, ownerId);
  const organizationId = await owner.mutation(api.organizations.create, {
    name: "Valuation Museum",
    slug: `valuation-${Math.random().toString(36).slice(2, 8)}`,
    type: "museum",
  });
  const collectionId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "VAL-1",
      title: "Portrait",
      status: "active",
      catalogedBy: ownerId,
      catalogedAt: NOW,
    }),
  );
  return { owner, organizationId, collectionId };
}

async function memberWithSystemRole(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  roleName: string,
) {
  const recognizedNames =
    SYSTEM_ROLE_DEFINITIONS.find((definition) => definition.name === roleName)
      ?.recognizedNames ?? [];
  const userId = await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();
    const role = roles.find(
      (candidate) =>
        candidate.isSystemRole && recognizedNames.includes(candidate.name),
    );
    if (!role) throw new Error(`No ${roleName} role`);
    const userId = await ctx.db.insert("users", {
      name: roleName,
      email: `${roleName.replace(" ", "-").toLowerCase()}@museum.test`,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId: role._id,
      joinedAt: NOW,
    });
    return userId;
  });
  return authedForUser(t, userId);
}

test("Administrators and Collection Managers read an object's valuations", async () => {
  const t = createConvexTest();
  const { owner, organizationId, collectionId } = await seededMuseum(t);
  await owner.mutation(api.appraisals.create, { collectionId, ...appraisal });

  for (const roleName of [ADMIN_ROLE_NAME, COLLECTION_MANAGER_ROLE_NAME]) {
    const member = await memberWithSystemRole(t, organizationId, roleName);
    const valuation = await member.query(api.appraisals.getObjectValuation, {
      collectionId,
      now: NOW,
    });
    expect(
      valuation?.current.map(({ value, currency, appraiserName }) => ({
        value,
        currency,
        appraiserName,
      })),
    ).toEqual([
      { value: 10_000, currency: "EUR", appraiserName: "Independent Valuer" },
    ]);
    expect(
      await member.query(api.insurance.checkAppraisalForCoverage, {
        collectionId,
        now: NOW,
      }),
    ).toMatchObject({ hasAppraisal: true, appraisalValue: 10_000 });
  }
});

test("Curators, Catalogers and Viewers are refused an object's valuations", async () => {
  const t = createConvexTest();
  const { owner, organizationId, collectionId } = await seededMuseum(t);
  const appraisalId = await owner.mutation(api.appraisals.create, {
    collectionId,
    ...appraisal,
  });

  for (const roleName of [
    CURATOR_ROLE_NAME,
    CATALOGER_ROLE_NAME,
    VIEWER_ROLE_NAME,
  ]) {
    const member = await memberWithSystemRole(t, organizationId, roleName);
    await expect(
      member.query(api.appraisals.getObjectValuation, {
        collectionId,
        now: NOW,
      }),
    ).rejects.toThrow("Permission denied");
    await expect(
      member.query(api.appraisals.get, { appraisalId }),
    ).rejects.toThrow("Permission denied");
    await expect(
      member.query(api.appraisals.list, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Permission denied");
    expect(
      await member.query(api.insurance.checkAppraisalForCoverage, {
        collectionId,
        now: NOW,
      }),
    ).toEqual({
      hasAppraisal: false,
      appraisalValid: false,
      warning: "Collection not found",
    });
  }
});

test("a Cataloger who may edit the object still cannot record or correct an appraisal", async () => {
  const t = createConvexTest();
  const { owner, organizationId, collectionId } = await seededMuseum(t);
  const appraisalId = await owner.mutation(api.appraisals.create, {
    collectionId,
    ...appraisal,
  });
  const cataloger = await memberWithSystemRole(
    t,
    organizationId,
    CATALOGER_ROLE_NAME,
  );

  await expect(
    cataloger.mutation(api.appraisals.create, { collectionId, ...appraisal }),
  ).rejects.toThrow("Permission denied");
  await expect(
    cataloger.mutation(api.appraisals.supersede, {
      appraisalId,
      reason: "Revised",
      ...appraisal,
      value: 1,
    }),
  ).rejects.toThrow("Permission denied");

  const valuation = await owner.query(api.appraisals.getObjectValuation, {
    collectionId,
    now: NOW,
  });
  expect(valuation?.history.map((entry) => entry.value)).toEqual([10_000]);
});

test("the valuation migration grants existing owner, administrator and collection manager roles only", async () => {
  vi.useFakeTimers();
  try {
    const t = createConvexTest();
    const roleNames = [
      SUPER_ADMIN_ROLE_NAME,
      "admin",
      ADMIN_ROLE_NAME,
      LEGACY_REGISTRAR_ROLE_NAME,
      COLLECTION_MANAGER_ROLE_NAME,
      "curator",
      "cataloger",
      "viewer",
    ];
    const organizationIds = await t.run(async ({ db }) => {
      const ids: Id<"organizations">[] = [];
      for (let index = 0; index < 30; index++) {
        const organizationId = await db.insert("organizations", {
          name: `Museum ${index}`,
          slug: `museum-${index}-${Math.random().toString(36).slice(2, 7)}`,
          type: "museum",
        });
        for (const name of roleNames) {
          await db.insert("roles", {
            organizationId,
            name,
            isSystemRole: true,
          });
        }
        await db.insert("roles", {
          organizationId,
          name: COLLECTION_MANAGER_ROLE_NAME,
          isSystemRole: false,
        });
        ids.push(organizationId);
      }
      return ids;
    });
    const [firstOrganizationId] = organizationIds;
    if (!firstOrganizationId) throw new Error("No organization");
    const { collectionId, registrar, customManager } = await t.run(
      async ({ db }) => {
        const roles = await db
          .query("roles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", firstOrganizationId),
          )
          .collect();
        const userId = await db.insert("users", { name: "Registrar" });
        const collectionId = await db.insert("collections", {
          organizationId: firstOrganizationId,
          accessionNumber: "MIG-1",
          title: "Migrated object",
          status: "active",
          catalogedBy: userId,
          catalogedAt: NOW,
        });
        await db.insert("appraisals", {
          organizationId: firstOrganizationId,
          collectionId,
          ...appraisal,
          createdBy: userId,
          createdAt: NOW,
        });
        const readPermissionId = await db.insert("permissions", {
          name: "collections.read",
          category: "collections",
        });
        const member = async (systemRole: boolean) => {
          const role = roles.find(
            (candidate) =>
              candidate.isSystemRole === systemRole &&
              (systemRole
                ? candidate.name === LEGACY_REGISTRAR_ROLE_NAME
                : candidate.name === COLLECTION_MANAGER_ROLE_NAME),
          );
          if (!role) throw new Error("No role");
          await db.insert("rolePermissions", {
            roleId: role._id,
            permissionId: readPermissionId,
          });
          const memberId = await db.insert("users", { name: role.name });
          await db.insert("userOrganizations", {
            userId: memberId,
            organizationId: firstOrganizationId,
            roleId: role._id,
            joinedAt: NOW,
          });
          return memberId;
        };
        return {
          collectionId,
          registrar: await member(true),
          customManager: await member(false),
        };
      },
    );
    const readValuation = (userId: Id<"users">) =>
      authedForUser(t, userId).query(api.appraisals.getObjectValuation, {
        collectionId,
        now: NOW,
      });
    await expect(readValuation(registrar)).rejects.toThrow("Permission denied");

    await t.mutation(internal.migrations.grantValuationPermissions, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(internal.migrations.grantValuationPermissions, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(
      (await readValuation(registrar))?.current.map((entry) => entry.value),
    ).toEqual([10_000]);
    await expect(readValuation(customManager)).rejects.toThrow(
      "Permission denied",
    );

    const grantsByRole = await t.run(async (ctx) => {
      const permissions = (await ctx.db.query("permissions").collect()).filter(
        (row) => row.name === "collections.view_valuation",
      );
      const counts = new Map<string, number>();
      for (const organizationId of organizationIds) {
        const roles = await ctx.db
          .query("roles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect();
        for (const role of roles) {
          const grants = await ctx.db
            .query("rolePermissions")
            .withIndex("by_role", (q) => q.eq("roleId", role._id))
            .collect();
          const key = `${role.isSystemRole ? "system" : "custom"} ${role.name}`;
          counts.set(
            key,
            (counts.get(key) ?? 0) +
              grants.filter((grant) =>
                permissions.some(
                  (permission) => permission._id === grant.permissionId,
                ),
              ).length,
          );
        }
      }
      return { permissionRows: permissions.length, counts: [...counts] };
    });

    expect(grantsByRole).toEqual({
      permissionRows: 1,
      counts: [
        ["system super_admin", 30],
        ["system admin", 30],
        ["system Administrator", 30],
        ["system registrar", 30],
        ["system Collection Manager", 30],
        ["system curator", 0],
        ["system cataloger", 0],
        ["system viewer", 0],
        ["custom Collection Manager", 0],
      ],
    });
  } finally {
    vi.useRealTimers();
  }
});

test("a Curator links valuation evidence on a pending deaccession without valuation access", async () => {
  const t = createConvexTest();
  const { owner, organizationId, collectionId } = await seededMuseum(t);
  const appraisalId = await owner.mutation(api.appraisals.create, {
    collectionId,
    ...appraisal,
    appraisalDate: Date.now() - 30 * DAY,
  });
  const supersededId = await owner.mutation(api.appraisals.create, {
    collectionId,
    ...appraisal,
    appraisalType: "market",
    value: 7_000,
    appraisalDate: Date.now() - 60 * DAY,
  });
  await owner.mutation(api.appraisals.supersede, {
    appraisalId: supersededId,
    reason: "Revised by the valuer",
    ...appraisal,
    appraisalType: "market",
    value: 7_500,
    appraisalDate: Date.now() - 60 * DAY,
  });
  const deaccessionId = await owner.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Outside collecting policy",
    method: "sale",
    disposition: "Public auction",
  });
  const curator = await memberWithSystemRole(
    t,
    organizationId,
    CURATOR_ROLE_NAME,
  );
  const viewer = await memberWithSystemRole(
    t,
    organizationId,
    VIEWER_ROLE_NAME,
  );

  const linkable = await curator.query(
    api.deaccessions.listLinkableAppraisals,
    { deaccessionId, now: Date.now() },
  );
  expect(
    linkable.map(({ value, appraisalType, appraiserName, ageDays }) => ({
      value,
      appraisalType,
      appraiserName,
      ageDays,
    })),
  ).toEqual([
    {
      value: 10_000,
      appraisalType: "insurance",
      appraiserName: "Independent Valuer",
      ageDays: 30,
    },
    {
      value: 7_500,
      appraisalType: "market",
      appraiserName: "Independent Valuer",
      ageDays: 60,
    },
  ]);
  await expect(
    viewer.query(api.deaccessions.listLinkableAppraisals, {
      deaccessionId,
      now: Date.now(),
    }),
  ).rejects.toThrow("Permission denied");

  await curator.mutation(api.deaccessions.linkAppraisal, {
    deaccessionId,
    appraisalId,
  });
  const stages = await viewer.query(api.deaccessions.getDisposalStages, {
    deaccessionId,
  });
  expect(stages?.valuation).toMatchObject({
    linkedAppraisalId: appraisalId,
    value: 10_000,
    currency: "EUR",
    appraiserName: "Independent Valuer",
  });
});
