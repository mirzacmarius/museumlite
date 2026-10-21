import { describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
  expectReady,
  rebuildProjection,
} from "./testHarness";

/**
 * MUS-833: "If a deletion of an object is rejected, it must return to its
 * original location in the collection." Each path that can leave a Removal
 * rejected is driven through public functions; afterwards the Object must be
 * back everywhere staff look for it.
 */

const STAFF_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "collections.delete",
  "collections.approve_deaccession",
  "collections.approve_accession",
  "locations.read",
  "locations.update",
  "organization.manage_settings",
  "organization.view_analytics",
];

type Viewer = ReturnType<typeof authedForUser>;

interface ObjectHome {
  organizationId: Id<"organizations">;
  collectionId: Id<"collections">;
  title: string;
  locationId?: Id<"locations">;
  collectionGroupId?: Id<"collectionGroups">;
  ownedOnOverview: number;
}

async function ownedOnOverview(
  viewer: Viewer,
  organizationId: Id<"organizations">,
) {
  return expectReady(
    await viewer.query(api.dashboard.getAnalytics, { organizationId }),
  ).objects.total;
}

async function placeObject(
  t: ConvexTest,
  viewer: Viewer,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  title: string,
): Promise<ObjectHome> {
  const placed = await t.run(async (ctx) => {
    const now = Date.now();
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Store Room 4",
      locationCode: "SR-4",
      locationCodeNormalized: "sr-4",
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    const collectionGroupId = await ctx.db.insert("collectionGroups", {
      organizationId,
      name: "Paintings",
      itemsCount: 1,
      createdAt: now,
      createdBy: userId,
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `ACC-2025-${Math.floor(Math.random() * 9000 + 1000)}`,
      title,
      status: "active",
      currentLocationId: locationId,
      collectionGroupId,
      catalogedBy: userId,
      catalogedAt: now - 1_000,
    });
    await ctx.db.insert("collectionGroupItems", {
      collectionGroupId,
      collectionId,
      role: "primary",
      addedAt: now,
      addedBy: userId,
    });
    return {
      organizationId,
      collectionId,
      locationId,
      collectionGroupId,
      title,
    };
  });
  await rebuildProjection(t, organizationId);
  return {
    ...placed,
    ownedOnOverview: await ownedOnOverview(viewer, organizationId),
  };
}

/** Runs scheduled work (notifications, projection upkeep) to its stored outcome. */
async function drainScheduledWork(t: ConvexTest) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
}

/** Every view in which the Object is not back where it was. Empty when it is. */
async function whereTheObjectIsMissing(
  t: ConvexTest,
  viewer: Viewer,
  home: ObjectHome,
) {
  await drainScheduledWork(t);
  const missing: string[] = [];
  const { organizationId, collectionId, locationId, collectionGroupId } = home;

  const object = await viewer.query(api.collections.get, { collectionId });
  if (object?.status !== "active") missing.push(`status: ${object?.status}`);
  if (object?.organizationId !== organizationId)
    missing.push("organization changed");
  if (object?.currentLocationId !== locationId)
    missing.push(`location: ${object?.currentLocationId ?? "none"}`);
  if (object?.collectionGroupId !== collectionGroupId)
    missing.push(`collectionGroupId: ${object?.collectionGroupId ?? "none"}`);

  const page = await viewer.query(api.collections.getObjectDetail, {
    collectionId,
  });
  if (page?.collection.status !== "active")
    missing.push(`object page status: ${page?.collection.status}`);
  if ((page?.locationPath.at(-1)?._id ?? undefined) !== locationId)
    missing.push("object page location");

  const catalog = async (filters: {
    status?: "active";
    locationIds?: Id<"locations">[];
    collectionGroupId?: Id<"collectionGroups">;
    search?: string;
  }) =>
    (
      await viewer.query(api.collections.list, {
        organizationId,
        paginationOpts: { numItems: 50, cursor: null },
        ...filters,
      })
    ).page.some((row) => row._id === collectionId);
  if (!(await catalog({}))) missing.push("Object Catalog");
  if (!(await catalog({ status: "active" })))
    missing.push("Object Catalog, status Active");
  if (!(await catalog({ search: home.title })))
    missing.push("Object Catalog, searched by title");
  if (locationId && !(await catalog({ locationIds: [locationId] })))
    missing.push("Object Catalog, filtered by its Location");
  if (collectionGroupId && !(await catalog({ collectionGroupId })))
    missing.push("Object Catalog, filtered by its Collection group");

  const search = await viewer.query(api.collections.search, {
    organizationId,
    searchQuery: home.title,
  });
  if (!search.results.some((row) => row._id === collectionId))
    missing.push("collections.search");

  if (locationId) {
    const atLocation = await viewer.query(api.locations.getObjectsAtLocation, {
      locationId,
    });
    if (
      !atLocation.some(
        (row) => row._id === collectionId && row.status === "active",
      )
    )
      missing.push("Location & Tracking");
  }

  if (collectionGroupId) {
    const groupItems = await viewer.query(api.collectionGroups.listItems, {
      groupId: collectionGroupId,
    });
    if (
      !groupItems.some(
        (row) => row.collectionId === collectionId && row.status === "active",
      )
    )
      missing.push("Collection group items");
  }

  const owned = await ownedOnOverview(viewer, organizationId);
  if (owned !== home.ownedOnOverview)
    missing.push(`Overview objects: ${owned}, was ${home.ownedOnOverview}`);

  const actions = await viewer.query(api.objectActions.get, { collectionId });
  if (actions?.deaccession.state !== "available")
    missing.push(`Removal action: ${JSON.stringify(actions?.deaccession)}`);
  if (actions?.remove.state !== "available")
    missing.push(`Remove object action: ${JSON.stringify(actions?.remove)}`);

  const eligibility = await viewer.query(api.objectMoves.getEligibility, {
    collectionId,
  });
  if (!eligibility.isEligible)
    missing.push(
      `transfer blocked: ${eligibility.blockers.map((b) => b.code).join(",")}`,
    );

  return missing;
}

/** Which Removals board columns hold the Removal. */
async function boardColumnsHolding(
  viewer: Viewer,
  organizationId: Id<"organizations">,
  deaccessionId: Id<"deaccessions">,
) {
  const steps = await viewer.query(api.deaccessions.getWorkflowSteps, {
    organizationId,
  });
  const columns = [
    ...steps.steps.flatMap((step) =>
      typeof step.stepNumber === "number"
        ? [{ kind: "step" as const, step: step.stepNumber }]
        : [],
    ),
    { kind: "approved" as const },
    { kind: "rejected" as const },
  ];
  const holding: string[] = [];
  for (const column of columns) {
    const page = await viewer.query(api.deaccessions.listBoardColumn, {
      organizationId,
      column,
      paginationOpts: { numItems: 50, cursor: null },
    });
    if (page.page.some((row) => row._id === deaccessionId))
      holding.push(
        column.kind === "step" ? `step ${column.step}` : column.kind,
      );
  }
  return holding;
}

async function museum(
  t: ConvexTest,
  stepCount: number,
  options: { workflow?: boolean } = {},
) {
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    STAFF_PERMISSIONS,
    { roleName: "Registrar", subscriptionTier: "pro" },
  );
  await t.run(async (ctx) => {
    if (options.workflow ?? true) {
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "deaccession",
        steps: Array.from({ length: stepCount }, (_, index) => ({
          stepNumber: index + 1,
          roleId,
          name: `Review ${index + 1}`,
        })),
        canInitiateRoles: [roleId],
      });
    } else {
      const organization = await ctx.db.get(organizationId);
      await ctx.db.patch(organizationId, {
        settings: {
          ...organization?.settings,
          deaccessionWorkflowEnabled: false,
        },
      });
    }
  });
  return { organizationId, userId, roleId, staff: authedForUser(t, userId) };
}

async function museumWithObject(
  t: ConvexTest,
  stepCount: number,
  options: { workflow?: boolean } = {},
) {
  const setup = await museum(t, stepCount, options);
  const home = await placeObject(
    t,
    setup.staff,
    setup.organizationId,
    setup.userId,
    "Portrait of a Woman with a Man at a Casement",
  );
  return { ...setup, home };
}

describe("MUS-833: a rejected Removal returns the Object", () => {
  for (const method of [
    "sale",
    "donation",
    "destruction",
    "transfer",
  ] as const) {
    test(`Sold form (${method}), rejected at the only approval step`, async () => {
      const t = createConvexTest();
      const { organizationId, staff, home } = await museumWithObject(t, 1);
      expect(await whereTheObjectIsMissing(t, staff, home)).toEqual([]);

      const deaccessionId = await staff.mutation(api.deaccessions.create, {
        organizationId,
        collectionId: home.collectionId,
        dateDeaccessioned: Date.now(),
        reason: "sold",
        method,
        targetCollectionStatus: "deaccessioned",
      });
      await staff.mutation(api.deaccessions.reject, {
        deaccessionId,
        comment: "Keep it",
      });

      expect(
        await boardColumnsHolding(staff, organizationId, deaccessionId),
      ).toEqual(["rejected"]);
      expect(await whereTheObjectIsMissing(t, staff, home)).toEqual([]);
    });
  }

  test("Sold, approved at step 1 of 3 then rejected at step 2", async () => {
    const t = createConvexTest();
    const { organizationId, staff, home } = await museumWithObject(t, 3);
    const deaccessionId = await staff.mutation(api.deaccessions.create, {
      organizationId,
      collectionId: home.collectionId,
      dateDeaccessioned: Date.now(),
      reason: "sold",
      method: "sale",
      targetCollectionStatus: "deaccessioned",
      disposition: "Auction house",
    });
    await staff.mutation(api.deaccessions.approve, { deaccessionId });
    expect(
      (await staff.query(api.deaccessions.get, { deaccessionId }))
        ?.workflowStep,
    ).toBe(2);

    await staff.mutation(api.deaccessions.reject, { deaccessionId });

    expect(
      await boardColumnsHolding(staff, organizationId, deaccessionId),
    ).toEqual(["rejected"]);
    expect(await whereTheObjectIsMissing(t, staff, home)).toEqual([]);
  });

  test("Sold without an approval workflow, held for a missing disposition, then rejected", async () => {
    const t = createConvexTest();
    const { organizationId, staff, home } = await museumWithObject(t, 0, {
      workflow: false,
    });
    const deaccessionId = await staff.mutation(api.deaccessions.create, {
      organizationId,
      collectionId: home.collectionId,
      dateDeaccessioned: Date.now(),
      reason: "sold",
      method: "sale",
      targetCollectionStatus: "deaccessioned",
    });
    expect(
      (await staff.query(api.deaccessions.get, { deaccessionId }))?.status,
    ).toBe("pending");

    await staff.mutation(api.deaccessions.reject, { deaccessionId });

    expect(
      await boardColumnsHolding(staff, organizationId, deaccessionId),
    ).toEqual(["rejected"]);
    expect(await whereTheObjectIsMissing(t, staff, home)).toEqual([]);
  });

  for (const target of ["archived", "deleted"] as const) {
    test(`a Withdrawal request (${target}) rejected`, async () => {
      const t = createConvexTest();
      const { organizationId, staff, home } = await museumWithObject(t, 1);
      const deaccessionId = await staff.mutation(api.deaccessions.create, {
        organizationId,
        collectionId: home.collectionId,
        dateDeaccessioned: Date.now(),
        reason: "remove",
        method: "destruction",
        targetCollectionStatus: target,
      });

      await staff.mutation(api.deaccessions.reject, { deaccessionId });

      expect(await whereTheObjectIsMissing(t, staff, home)).toEqual([]);
    });
  }

  test("bulk Removal from the Object Catalog, rejected", async () => {
    const t = createConvexTest();
    const { organizationId, staff, home } = await museumWithObject(t, 1);
    await staff.mutation(api.collections.bulkDeaccession, {
      collectionIds: [home.collectionId],
      reason: "sold",
    });
    const pending = await staff.query(api.deaccessions.listBoardColumn, {
      organizationId,
      column: { kind: "step", step: 1 },
      paginationOpts: { numItems: 10, cursor: null },
    });
    const deaccessionId = pending.page[0]?._id;
    if (!deaccessionId) throw new Error("bulk Removal created nothing");

    await staff.mutation(api.deaccessions.reject, { deaccessionId });

    expect(
      await boardColumnsHolding(staff, organizationId, deaccessionId),
    ).toEqual(["rejected"]);
    expect(await whereTheObjectIsMissing(t, staff, home)).toEqual([]);
  });
});

describe("MUS-833: a rejected move to another organization returns the Object", () => {
  async function addReceivingMuseum(
    t: ConvexTest,
    source: { organizationId: Id<"organizations">; userId: Id<"users"> },
  ) {
    return await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Receiving Museum",
        slug: `receiving-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId: source.organizationId,
        rootOrganizationId: source.organizationId,
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Receiving Admin",
        isSystemRole: false,
      });
      for (const name of [
        "organization.manage_settings",
        "collections.read",
        "collections.create",
      ]) {
        const permissionId = await ctx.db.insert("permissions", {
          name,
          category: name.split(".")[0] ?? "collections",
        });
        await ctx.db.insert("rolePermissions", { roleId, permissionId });
      }
      await ctx.db.insert("userOrganizations", {
        userId: source.userId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      return organizationId;
    });
  }

  async function twoMuseums(t: ConvexTest) {
    const source = await museumWithObject(t, 1);
    return {
      ...source,
      targetOrganizationId: await addReceivingMuseum(t, source),
    };
  }

  async function requestMove(
    staff: Viewer,
    collectionId: Id<"collections">,
    targetOrganizationId: Id<"organizations">,
  ) {
    return await staff.mutation(api.objectMoves.createRequest, {
      collectionId,
      targetOrganizationId,
      reason: "sold",
    });
  }

  test("the sender's administrator rejects the request", async () => {
    const t = createConvexTest();
    const museums = await twoMuseums(t);
    const requestId = await requestMove(
      museums.staff,
      museums.home.collectionId,
      museums.targetOrganizationId,
    );

    await museums.staff.mutation(api.objectMoves.reject, { requestId });

    expect(
      await whereTheObjectIsMissing(t, museums.staff, museums.home),
    ).toEqual([]);
  });

  test("the receiving organization declines after the sender approved", async () => {
    const t = createConvexTest();
    const museums = await twoMuseums(t);
    const requestId = await requestMove(
      museums.staff,
      museums.home.collectionId,
      museums.targetOrganizationId,
    );
    await museums.staff.mutation(api.objectMoves.approve, { requestId });
    const request = await museums.staff.query(api.objectMoves.get, {
      requestId,
    });
    const deaccessionId = request?.deaccessionId;
    if (!deaccessionId) throw new Error("approval recorded no Removal");

    await museums.staff.mutation(api.objectMoves.reject, { requestId });

    expect(
      await boardColumnsHolding(
        museums.staff,
        museums.organizationId,
        deaccessionId,
      ),
    ).toEqual(["rejected"]);
    expect(
      await whereTheObjectIsMissing(t, museums.staff, museums.home),
    ).toEqual([]);
  });

  test("the requester cancels", async () => {
    const t = createConvexTest();
    const museums = await twoMuseums(t);
    const requestId = await requestMove(
      museums.staff,
      museums.home.collectionId,
      museums.targetOrganizationId,
    );

    await museums.staff.mutation(api.objectMoves.cancel, { requestId });

    expect(
      await whereTheObjectIsMissing(t, museums.staff, museums.home),
    ).toEqual([]);
  });

  // The screenshot's Object: "Accession ACC-2025-0019", published by accepting
  // a seeded intake without draft data, then moved with the reason "sold".
  for (const placed of [false, true]) {
    test(`an Object published from an accepted Accession${placed ? " and then placed in a Location" : ""}, declined by the receiver`, async () => {
      const t = createConvexTest();
      const source = await museum(t, 1);
      const accessionId = await t.run((ctx) =>
        ctx.db.insert("accessions", {
          organizationId: source.organizationId,
          accessionNumber: "ACC-2025-0019",
          dateReceived: Date.now() - 86_400_000,
          source: "Private collector",
          method: "purchase",
          status: "pending",
          notes: "Awaiting documentation review",
          assignedTo: source.userId,
          workflowStep: 1,
        }),
      );
      await source.staff.mutation(api.accessions.approve, { accessionId });
      const collectionId = (await t.run((ctx) => ctx.db.get(accessionId)))
        ?.collectionId;
      if (!collectionId) throw new Error("the Accession published no Object");
      const object = await source.staff.query(api.collections.get, {
        collectionId,
      });
      expect(object?.title).toBe("Accession ACC-2025-0019");

      let locationId: Id<"locations"> | undefined;
      if (placed) {
        locationId = await t.run((ctx) =>
          ctx.db.insert("locations", {
            organizationId: source.organizationId,
            name: "Store Room 4",
            locationCode: "SR-4",
            locationCodeNormalized: "sr-4",
            type: "room",
            sortOrder: 0,
            isActive: true,
          }),
        );
        await source.staff.mutation(api.locations.moveObject, {
          collectionId,
          toLocationId: locationId,
          expectedFromLocationId: null,
        });
      }
      const targetOrganizationId = await addReceivingMuseum(t, source);
      await rebuildProjection(t, source.organizationId);
      const home: ObjectHome = {
        organizationId: source.organizationId,
        collectionId,
        title: "Accession ACC-2025-0019",
        locationId,
        ownedOnOverview: await ownedOnOverview(
          source.staff,
          source.organizationId,
        ),
      };
      expect(await whereTheObjectIsMissing(t, source.staff, home)).toEqual([]);

      const requestId = await requestMove(
        source.staff,
        collectionId,
        targetOrganizationId,
      );
      await source.staff.mutation(api.objectMoves.approve, { requestId });
      await source.staff.mutation(api.objectMoves.reject, { requestId });

      expect(await whereTheObjectIsMissing(t, source.staff, home)).toEqual([]);
    });
  }
});
