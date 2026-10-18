import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { capabilityUnavailableFromError } from "../convex/utils/capabilities";
import type { CaseTaskCaseType } from "../convex/utils/caseTaskValidators";
import { CASE_TYPES, caseHref } from "../convex/utils/caseTypes";
import { notificationEntityHref } from "../convex/utils/notificationLinks";
import { workErrorFromError } from "../convex/utils/workErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  type SubscriptionTier,
} from "./testHarness";
import { myTasks } from "./workBoardHarness";

const EVERY_PERMISSION = [
  "collections.read",
  "collections.update",
  "collections.coordinate_incidents",
  "loans.read",
  "loans.update",
  "locations.read",
  "locations.update",
];

/** Roles that see different subsets of the case types. */
const ROLES: Record<string, string[]> = {
  everything: EVERY_PERMISSION,
  collectionsReader: ["collections.read"],
  collectionsEditor: ["collections.read", "collections.update"],
  facilities: ["locations.read", "locations.update"],
  inventoryReader: ["collections.read", "locations.read"],
  loansOnly: ["loans.read", "loans.update"],
  nothing: [],
};

/** Whether the call is let through; refusals and hidden cases are not, and anything else is a fault. */
function allowed(call: Promise<unknown>) {
  return call.then(
    () => true,
    (error) => {
      if (
        capabilityUnavailableFromError(error) ||
        workErrorFromError(error)?.code === "CASE_NOT_FOUND"
      )
        return false;
      throw error;
    },
  );
}

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
  permissions: string[],
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name,
      email: `${name}@example.test`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: `${name} role`,
      isSystemRole: false,
    });
    const existing = new Map(
      (await ctx.db.query("permissions").collect()).map((row) => [
        row.name,
        row._id,
      ]),
    );
    for (const permission of permissions) {
      const permissionId =
        existing.get(permission) ??
        (await ctx.db.insert("permissions", {
          name: permission,
          category: permission.split(".")[0] as "collections",
        }));
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: 1,
    });
    return userId;
  });
}

/** One case of every kind, plus a sensitive incident nobody below is named on. */
async function seedCases(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  adminId: Id<"users">,
) {
  return t.run(async (ctx) => {
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Store",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const objectId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "OBJ-1",
      title: "Vase",
      status: "active",
      catalogedBy: adminId,
      catalogedAt: 1,
      currentLocationId: locationId,
    });
    const incident = (sensitive: boolean, number: string) =>
      ctx.db.insert("incidents", {
        organizationId,
        incidentNumber: number,
        kind: "damage",
        title: "Broken case glass",
        status: "reported",
        open: true,
        sensitive,
        discoveredAt: 1,
        locationIds: [locationId],
        reportedBy: adminId,
        reportedAt: 1,
        intakeKey: number,
        responderIds: [],
        plans: [],
        eventCount: 0,
        updatedAt: 1,
      });
    const profileId = await ctx.db.insert("documentationProfiles", {
      organizationId,
      name: "Located",
      stages: ["collection"],
      requirements: ["current_location"],
      status: "active",
      version: 1,
      createdBy: adminId,
      createdAt: 1,
      updatedBy: adminId,
      updatedAt: 1,
    });
    const sessionId = await ctx.db.insert("inventorySessions", {
      organizationId,
      name: "Store count",
      scopeLocationId: locationId,
      includeSublocations: false,
      scopeLocationIds: [locationId],
      status: "reviewing",
      expectedCount: 1,
      observedExpectedCount: 0,
      observationCount: 0,
      openExceptionCount: 1,
      exceptionCount: 1,
      startedBy: adminId,
      startedAt: 1,
    });
    const cases: Array<{
      name: string;
      caseType: CaseTaskCaseType;
      caseId: string;
    }> = [
      {
        name: "loan",
        caseType: "loan",
        caseId: await ctx.db.insert("loans", {
          organizationId,
          loanNumber: "L-001",
          type: "outgoing",
          lenderBorrowerName: "Partner Museum",
          startDate: 1,
          status: "pending",
        }),
      },
      {
        name: "accession",
        caseType: "accession",
        caseId: await ctx.db.insert("accessions", {
          organizationId,
          accessionNumber: "A-001",
          dateReceived: 1,
          source: "Donor",
          method: "gift",
          status: "pending",
          collectionId: objectId,
        }),
      },
      {
        name: "deaccession",
        caseType: "deaccession",
        caseId: await ctx.db.insert("deaccessions", {
          organizationId,
          collectionId: objectId,
          deaccessionNumber: "D-001",
          dateDeaccessioned: 1,
          reason: "Duplicate",
          method: "transfer",
          status: "pending",
        }),
      },
      {
        name: "exhibition",
        caseType: "exhibition",
        caseId: await ctx.db.insert("exhibitions", {
          organizationId,
          title: "Spring show",
          startDate: 1,
          isCurrent: false,
          status: "proposed",
        }),
      },
      {
        name: "conservation",
        caseType: "conservation",
        caseId: await ctx.db.insert("conservationTreatments", {
          organizationId,
          collectionId: objectId,
          treatmentType: "cleaning",
          title: "Surface clean",
          description: "Surface clean",
          performedBy: adminId,
          performedAt: 1,
          status: "proposed",
        }),
      },
      {
        name: "documentationFinding",
        caseType: "documentationFinding",
        caseId: await ctx.db.insert("documentationFindings", {
          organizationId,
          key: `missing_evidence:${objectId}`,
          kind: "missing_evidence",
          objectId,
          objectIdentifier: "OBJ-1",
          objectTitle: "Vase",
          stage: "collection",
          profileId,
          profileName: "Located",
          missing: ["current_location"],
          status: "open",
          standing: true,
          signature: "current_location",
          firstCheckNumber: 1,
          lastCheckNumber: 1,
          firstDetectedAt: 1,
          lastDetectedAt: 1,
        }),
      },
      {
        name: "incident",
        caseType: "incident",
        caseId: await incident(false, "INC-1"),
      },
      {
        name: "sensitiveIncident",
        caseType: "incident",
        caseId: await incident(true, "INC-2"),
      },
      {
        name: "inventoryException",
        caseType: "inventoryException",
        caseId: await ctx.db.insert("inventoryExceptions", {
          organizationId,
          sessionId,
          kind: "missing",
          status: "open",
          label: "OBJ-1",
          collectionId: objectId,
          recordedLocationId: locationId,
          detectedAt: 1,
        }),
      },
    ];
    return cases;
  });
}

async function setup() {
  const t = createConvexTest();
  const organizationId = await t.run((ctx) =>
    ctx.db.insert("organizations", {
      name: "Home Museum",
      slug: "home-museum",
      type: "museum",
      subscriptionTier: "enterprise",
    }),
  );
  const adminId = await addMember(t, organizationId, "admin", EVERY_PERMISSION);
  const cases = await seedCases(t, organizationId, adminId);
  return { t, organizationId, adminId, cases };
}

test("every case type: a task is in My work exactly when its case opens for the owner", async () => {
  const { t, organizationId, adminId, cases } = await setup();
  const members = await Promise.all(
    Object.entries(ROLES).map(async ([role, permissions]) => {
      const userId = await addMember(t, organizationId, role, permissions);
      await t.run(async (ctx) => {
        for (const { caseType, caseId } of cases)
          await ctx.db.insert("caseTasks", {
            organizationId,
            caseType,
            caseId,
            title: "Check the case",
            ownerId: userId,
            queueDueAt: Number.MAX_SAFE_INTEGER,
            status: "todo",
            open: true,
            dependsOnTaskIds: [],
            createdBy: adminId,
            createdAt: 1,
            updatedAt: 1,
          });
      });
      return { role, member: authedForUser(t, userId) };
    }),
  );

  const visibility = async (tier: SubscriptionTier) => {
    await t.run((ctx) =>
      ctx.db.patch(organizationId, { subscriptionTier: tier }),
    );
    return Object.fromEntries(
      await Promise.all(
        members.map(async ({ role, member }) => {
          const queue = await myTasks(member, organizationId);
          const queued = new Set(queue.map((task) => task.caseId));
          const rows = await Promise.all(
            cases.map(async ({ name, caseType, caseId }) => {
              const opens = await allowed(
                member.query(api.caseTasks.listForCase, {
                  organizationId,
                  caseType,
                  caseId,
                }),
              );
              return [name, { queued: queued.has(caseId), opens }] as const;
            }),
          );
          return [role, Object.fromEntries(rows)] as const;
        }),
      ),
    );
  };

  for (const tier of ["free", "enterprise"] as const) {
    const byRole = await visibility(tier);
    for (const [role, byCase] of Object.entries(byRole))
      for (const [name, { queued, opens }] of Object.entries(byCase))
        expect({ tier, role, name, queued }).toEqual({
          tier,
          role,
          name,
          queued: opens,
        });
    // Guard against a rule that hides everything from everyone.
    expect(
      Object.values(byRole.everything ?? {}).filter((row) => row.opens).length,
    ).toBe(tier === "enterprise" ? cases.length : cases.length - 3);
    expect(Object.values(byRole.nothing ?? {}).some((row) => row.opens)).toBe(
      false,
    );
  }
});

test("every case type filed in the audit log: its history filters exactly when the case opens", async () => {
  const { t, organizationId, cases } = await setup();
  const analysts = await Promise.all(
    Object.entries(ROLES).map(async ([role, permissions]) => {
      const userId = await addMember(t, organizationId, `${role}-analyst`, [
        ...permissions,
        "organization.view_analytics",
      ]);
      return { role, analyst: authedForUser(t, userId) };
    }),
  );
  const filed = cases.filter(
    ({ caseType }) => CASE_TYPES[caseType].auditCase !== false,
  );

  for (const tier of ["free", "enterprise"] as const) {
    await t.run((ctx) =>
      ctx.db.patch(organizationId, { subscriptionTier: tier }),
    );
    for (const { role, analyst } of analysts)
      for (const { name, caseType, caseId } of filed) {
        const [filters, opens] = await Promise.all([
          allowed(
            analyst.query(api.auditLog.list, {
              organizationId,
              caseId: `${CASE_TYPES[caseType].entityType}:${caseId}`,
            }),
          ),
          allowed(
            analyst.query(api.caseTasks.listForCase, {
              organizationId,
              caseType,
              caseId,
            }),
          ),
        ]);
        expect({ tier, role, name, filters }).toEqual({
          tier,
          role,
          name,
          filters: opens,
        });
      }
  }
});

test("every case type: a task notification opens the app's case link", async () => {
  const { t, organizationId, adminId, cases } = await setup();
  const ownerId = await addMember(t, organizationId, "owner", EVERY_PERMISSION);
  const admin = authedForUser(t, adminId);

  for (const { caseType, caseId } of cases) {
    await admin.mutation(api.caseTasks.create, {
      organizationId,
      caseType,
      caseId,
      title: "Check the case",
      ownerId,
    });
    const notification = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", ownerId))
          .collect()
      ).find((row) => row.relatedEntityId === caseId),
    );

    expect(
      notificationEntityHref(
        notification?.relatedEntityType,
        notification?.relatedEntityId,
      ),
    ).toBe(caseHref(caseType, caseId));
  }
});
