import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api.js";
import type { Id } from "../convex/_generated/dataModel.js";
import schema from "../convex/schema.js";
import { objectMoveErrorFromError } from "../convex/utils/objectMoveErrors";
import { rebuildProjection } from "./testHarness";
import { modules } from "./testSetup.js";
import { workColumn } from "./workBoardHarness";

/** The coded refusal a rejected call carries, so the app can translate it. */
async function refusal(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return objectMoveErrorFromError(error) ?? { code: String(error) };
  }
  throw new Error("Expected the call to be rejected");
}

function notificationsFor(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
) {
  return t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
}

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|object-moves-session`,
    issuer: "https://example.test",
  });
}

function getPermissionCategory(permissionName: string) {
  const prefix = permissionName.split(".")[0];
  switch (prefix) {
    case "collections":
    case "organization":
    case "locations":
    case "loans":
      return prefix;
    default:
      return "collections";
  }
}

async function createUser(
  t: ReturnType<typeof convexTest>,
  name: string,
  email: string,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name,
      email,
      username: email.split("@")[0],
    });
  });
}

async function createOrganization(
  t: ReturnType<typeof convexTest>,
  name: string,
  slug: string,
  settings?: {
    accessionNumberFormat?: string;
    accessionCounterScope?: "global" | "year" | "month" | "day";
    autoGenerateAccessionNumbers?: boolean;
    allowIncomingTransferRequests?: boolean;
  },
  hierarchy?: {
    parentOrganizationId?: Id<"organizations">;
    rootOrganizationId?: Id<"organizations">;
    subscriptionTier?: "free" | "pro" | "enterprise";
    accountNumber?: string;
    allowsIncomingTransferRequests?: boolean;
  },
) {
  return await t.run(async (ctx) => {
    const allowsIncomingTransferRequests =
      hierarchy?.allowsIncomingTransferRequests ??
      settings?.allowIncomingTransferRequests ??
      false;

    return await ctx.db.insert("organizations", {
      name,
      slug,
      type: "museum",
      settings,
      accountNumber: hierarchy?.accountNumber,
      allowsIncomingTransferRequests,
      subscriptionTier: hierarchy?.subscriptionTier,
      parentOrganizationId: hierarchy?.parentOrganizationId,
      rootOrganizationId: hierarchy?.rootOrganizationId,
    });
  });
}

async function createRoleWithPermissions(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  permissionNames: string[],
  roleName: string,
) {
  const [roleId, permissionIds] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: roleName,
        isSystemRole: false,
      });
    }),
    Promise.all(
      [...new Set(permissionNames)].map((permissionName) =>
        t.run(async (ctx) => {
          return await ctx.db.insert("permissions", {
            name: permissionName,
            category: getPermissionCategory(permissionName),
          });
        }),
      ),
    ),
  ]);
  await Promise.all(
    permissionIds.map((permissionId) =>
      t.run(async (ctx) => {
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      }),
    ),
  );

  return roleId;
}

async function addMembership(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  roleId: Id<"roles">,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });
}

async function createCollectionGroup(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("collectionGroups", {
      organizationId,
      name: "Move Test Group",
      itemsCount: 1,
      createdAt: Date.now(),
      createdBy: userId,
    });
  });
}

async function createLocation(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("locations", {
      organizationId,
      name: "Storage A",
      locationCode: "ST-001",
      locationCodeNormalized: "st-001",
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
  });
}

async function createCollection(
  t: ReturnType<typeof convexTest>,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    accessionNumber?: string;
    collectionGroupId?: Id<"collectionGroups">;
    currentLocationId?: Id<"locations">;
  },
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("collections", {
      organizationId: args.organizationId,
      collectionGroupId: args.collectionGroupId,
      currentLocationId: args.currentLocationId,
      accessionNumber: args.accessionNumber ?? "SRC-001",
      accessionNumberHistory: [
        {
          number: args.accessionNumber ?? "SRC-001",
          validFrom: now - 1_000,
        },
      ],
      title: "Move Test Object",
      status: "active",
      catalogedBy: args.userId,
      catalogedAt: now - 1_000,
    });
  });
}

async function createMoveFixture(
  t: ReturnType<typeof convexTest>,
  options?: {
    targetSettings?: {
      accessionNumberFormat?: string;
      accessionCounterScope?: "global" | "year" | "month" | "day";
      autoGenerateAccessionNumbers?: boolean;
    };
  },
) {
  const [requesterId, adminId, targetAdminId, sourceOrganizationId] =
    await Promise.all([
      createUser(
        t,
        "Requester",
        `requester-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      ),
      createUser(
        t,
        "Admin",
        `admin-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      ),
      createUser(
        t,
        "Target Admin",
        `target-admin-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      ),
      createOrganization(
        t,
        "Source Museum",
        `source-${Math.random().toString(36).slice(2, 8)}`,
        undefined,
        { subscriptionTier: "pro" },
      ),
    ]);
  const [targetOrganizationId, requesterSourceRoleId] = await Promise.all([
    createOrganization(
      t,
      "Target Museum",
      `target-${Math.random().toString(36).slice(2, 8)}`,
      options?.targetSettings,
      {
        parentOrganizationId: sourceOrganizationId,
        rootOrganizationId: sourceOrganizationId,
      },
    ),
    createRoleWithPermissions(
      t,
      sourceOrganizationId,
      ["collections.create", "collections.update", "collections.read"],
      "Requester Source Role",
    ),
  ]);
  const [requesterTargetRoleId, adminRoleId, targetAdminRoleId] =
    await Promise.all([
      createRoleWithPermissions(
        t,
        targetOrganizationId,
        ["collections.create", "collections.read"],
        "Requester Target Role",
      ),
      createRoleWithPermissions(
        t,
        sourceOrganizationId,
        ["organization.manage_settings", "collections.read"],
        "Source Admin Role",
      ),
      createRoleWithPermissions(
        t,
        targetOrganizationId,
        [
          "organization.manage_settings",
          "collections.read",
          "collections.create",
        ],
        "Target Admin Role",
      ),
    ]);
  await addMembership(
    t,
    requesterId,
    sourceOrganizationId,
    requesterSourceRoleId,
  );
  await addMembership(
    t,
    requesterId,
    targetOrganizationId,
    requesterTargetRoleId,
  );
  await addMembership(t, adminId, sourceOrganizationId, adminRoleId);
  await addMembership(
    t,
    targetAdminId,
    targetOrganizationId,
    targetAdminRoleId,
  );

  const [collectionGroupId, locationId, targetLocationId] = await Promise.all([
    createCollectionGroup(t, sourceOrganizationId, requesterId),
    createLocation(t, sourceOrganizationId),
    t.run(async (ctx) => {
      return await ctx.db.insert("locations", {
        organizationId: targetOrganizationId,
        name: "Receiving Bay",
        locationCode: "RCV-001",
        locationCodeNormalized: "rcv-001",
        type: "room",
        sortOrder: 0,
        isActive: true,
      });
    }),
  ]);
  const collectionId = await createCollection(t, {
    organizationId: sourceOrganizationId,
    userId: requesterId,
    collectionGroupId,
    currentLocationId: locationId,
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("collectionGroupItems", {
      collectionGroupId,
      collectionId,
      addedAt: Date.now(),
      addedBy: requesterId,
    });

    await ctx.db.insert("objectComments", {
      organizationId: sourceOrganizationId,
      objectId: collectionId,
      userId: requesterId,
      content: "Ready to transfer",
      createdAt: Date.now(),
    });

    await ctx.db.insert("appraisals", {
      organizationId: sourceOrganizationId,
      collectionId,
      appraisalDate: Date.now(),
      appraiserName: "Appraiser",
      appraisalType: "insurance",
      value: 2_500,
      currency: "USD",
      createdBy: requesterId,
      createdAt: Date.now(),
      isCurrentAppraisal: true,
    });
  });

  return {
    requesterId,
    adminId,
    targetAdminId,
    sourceOrganizationId,
    targetOrganizationId,
    collectionId,
    collectionGroupId,
    locationId,
    targetLocationId,
    requester: authedForUser(t, requesterId),
    admin: authedForUser(t, adminId),
    targetAdmin: authedForUser(t, targetAdminId),
  };
}

describe("objectMoves", () => {
  test("creates a move request and notifies source admins", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Transfer into a shared target organization",
        notes: "Curatorial ownership change",
      },
    );

    const request = await t.run(async (ctx) => {
      return await ctx.db.get(requestId);
    });

    expect(request?.status).toBe("pending_source_approval");
    expect(request?.sourceOrganizationId).toBe(fixture.sourceOrganizationId);
    expect(request?.targetOrganizationId).toBe(fixture.targetOrganizationId);

    const notifications = await t.run(async (ctx) => {
      return await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", fixture.adminId))
        .collect();
    });

    expect(
      notifications.some(
        (notification) =>
          notification.type === "move_request_created" &&
          notification.relatedEntityType === "move_request" &&
          notification.relatedEntityId === requestId,
      ),
    ).toBe(true);

    const auditEntries = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q
            .eq("entityType", "organizationMoveRequest")
            .eq("entityId", requestId),
        )
        .collect();
    });

    expect(
      auditEntries.some(
        (entry) => entry.action === "created_organization_move_request",
      ),
    ).toBe(true);
  });

  test("fails when target organization is the same as the source organization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await expect(
      fixture.requester.mutation(api.objectMoves.createRequest, {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.sourceOrganizationId,
        accessionMode: "manual",
        requestedAccessionNumber: "SRC-900",
        reason: "Invalid same-org move",
      }),
    ).rejects.toThrow("destination organization must be different");
  });

  test("fails when target organization is outside the source hierarchy", async () => {
    const t = convexTest(schema, modules);
    const [fixture, externalOrganizationId] = await Promise.all([
      createMoveFixture(t),
      createOrganization(
        t,
        "External Museum",
        `external-${Math.random().toString(36).slice(2, 8)}`,
        undefined,
        { subscriptionTier: "pro" },
      ),
    ]);
    const externalRoleId = await createRoleWithPermissions(
      t,
      externalOrganizationId,
      ["collections.create", "collections.read"],
      "External Role",
    );
    await addMembership(
      t,
      fixture.requesterId,
      externalOrganizationId,
      externalRoleId,
    );

    await expect(
      fixture.requester.mutation(api.objectMoves.createRequest, {
        collectionId: fixture.collectionId,
        targetOrganizationId: externalOrganizationId,
        accessionMode: "keep",
        reason: "Invalid cross-hierarchy move",
      }),
    ).rejects.toThrow("same hierarchy");
  });

  test("fails when the requester is not a member of the target organization", async () => {
    const t = convexTest(schema, modules);
    const [requesterId, sourceOrganizationId, targetOrganizationId] =
      await Promise.all([
        createUser(
          t,
          "Requester",
          `solo-${Math.random().toString(36).slice(2, 8)}@test.dev`,
        ),
        createOrganization(
          t,
          "Source Museum",
          `source-${Math.random().toString(36).slice(2, 8)}`,
        ),
        createOrganization(
          t,
          "Target Museum",
          `target-${Math.random().toString(36).slice(2, 8)}`,
        ),
      ]);
    const sourceRoleId = await createRoleWithPermissions(
      t,
      sourceOrganizationId,
      ["collections.update"],
      "Source Role",
    );
    await addMembership(t, requesterId, sourceOrganizationId, sourceRoleId);

    const collectionId = await createCollection(t, {
      organizationId: sourceOrganizationId,
      userId: requesterId,
    });

    const requester = authedForUser(t, requesterId);

    await expect(
      requester.mutation(api.objectMoves.createRequest, {
        collectionId,
        targetOrganizationId,
        accessionMode: "keep",
        reason: "Requester does not belong to target org",
      }),
    ).rejects.toThrow("Permission denied: collections.create");
  });

  test("fails when a pending move request already exists", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await fixture.requester.mutation(api.objectMoves.createRequest, {
      collectionId: fixture.collectionId,
      targetOrganizationId: fixture.targetOrganizationId,
      accessionMode: "keep",
      reason: "Initial move request",
    });

    await expect(
      fixture.requester.mutation(api.objectMoves.createRequest, {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Duplicate move request",
      }),
    ).rejects.toThrow("pending organization move request");
  });

  test("fails for blocked objects that are on active loan", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        organizationId: fixture.sourceOrganizationId,
        loanNumber: "LN-001",
        type: "outgoing",
        lenderBorrowerName: "Borrower",
        startDate: Date.now(),
        status: "active",
      });

      await ctx.db.insert("loanItems", {
        loanId,
        collectionId: fixture.collectionId,
      });
    });

    await expect(
      fixture.requester.mutation(api.objectMoves.createRequest, {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Move while object is on loan",
      }),
    ).rejects.toThrow("currently on loan");
  });

  test("listForOrganization returns typed summaries and supports search", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await fixture.requester.mutation(api.objectMoves.createRequest, {
      collectionId: fixture.collectionId,
      targetOrganizationId: fixture.targetOrganizationId,
      accessionMode: "manual",
      requestedAccessionNumber: "TGT-SEARCH-001",
      reason: "Curatorial transfer for gallery rotation",
      notes: "Handle with registrar review",
    });

    const requests = await fixture.admin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.sourceOrganizationId,
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      collectionId: fixture.collectionId,
      collectionTitle: "Move Test Object",
      sourceAccessionNumber: "SRC-001",
      requestedAccessionNumber: "TGT-SEARCH-001",
      accessionMode: "manual",
      targetOrganizationId: fixture.targetOrganizationId,
      targetOrganizationName: "Target Museum",
      reason: "Curatorial transfer for gallery rotation",
      notes: "Handle with registrar review",
      status: "pending_source_approval",
      requestedBy: fixture.requesterId,
      requestedByName: "Requester",
      direction: "outgoing",
    });

    const matchingSearches = [
      "move test object",
      "src-001",
      "target museum",
      "requester",
      "gallery rotation",
      "registrar review",
      "tgt-search-001",
    ];

    await Promise.all(
      Array.from(matchingSearches).map(async (search) => {
        const result = await fixture.admin.query(
          api.objectMoves.listForOrganization,
          {
            organizationId: fixture.sourceOrganizationId,
            search,
          },
        );
        expect(result).toHaveLength(1);
        expect(result[0]?._id).toBe(requests[0]?._id);
      }),
    );
  });

  test("listForOrganization hides source-pending requests from the target organization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await fixture.requester.mutation(api.objectMoves.createRequest, {
      collectionId: fixture.collectionId,
      targetOrganizationId: fixture.targetOrganizationId,
      accessionMode: "keep",
      reason: "Source-scoped listing check",
    });

    const targetScopedRequests = await fixture.targetAdmin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.targetOrganizationId,
      },
    );

    expect(targetScopedRequests).toHaveLength(0);
  });

  test("source approval creates a transfer deaccession without moving the object", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Approved move",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, {
      requestId,
      reviewNotes: "Approved by source admin",
    });

    const [collection, request] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(fixture.collectionId);
      }),
      t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      }),
    ]);
    const deaccession = request?.deaccessionId
      ? await t.run(async (ctx) => {
          return await ctx.db.get(request.deaccessionId!);
        })
      : null;

    expect(request?.status).toBe("awaiting_acceptance");
    expect(request?.sourceReviewNotes).toBe("Approved by source admin");
    expect(request?.deaccessionId).toBeDefined();
    expect(deaccession?.method).toBe("transfer");
    expect(deaccession?.status).toBe("approved");
    expect(collection?.organizationId).toBe(fixture.sourceOrganizationId);
    expect(collection?.accessionNumber).toBe("SRC-001");
  });

  test("target acceptance moves the object, clears source-only links, and updates related records", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("coinsStampsDetails", {
        organizationId: fixture.sourceOrganizationId,
        collectionId: fixture.collectionId,
        itemCategory: "stamp",
        catalogNumber: "MOVE-CS-001",
        createdAt: Date.now(),
      });
    });

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Approved move",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, {
      requestId,
      reviewNotes: "Approved by source admin",
    });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
      reviewNotes: "Accepted by target admin",
    });

    const [
      collection,
      request,
      remainingGroupLinks,
      movedComments,
      movedAppraisals,
      movedCoinsStampsDetails,
      requesterNotifications,
      sourceAuditEntries,
      targetAuditEntries,
    ] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(fixture.collectionId);
      }),
      t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("collectionGroupItems")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", fixture.collectionId),
          )
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("objectComments")
          .withIndex("by_object", (q) => q.eq("objectId", fixture.collectionId))
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("appraisals")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", fixture.collectionId),
          )
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("coinsStampsDetails")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", fixture.collectionId),
          )
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", fixture.requesterId))
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", fixture.sourceOrganizationId),
          )
          .collect();
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", fixture.targetOrganizationId),
          )
          .collect();
      }),
    ]);
    expect(request?.status).toBe("executed");
    expect(request?.finalAccessionNumber).toBe("SRC-001");
    expect(request?.targetReviewNotes).toBe("Accepted by target admin");
    expect(collection?.organizationId).toBe(fixture.targetOrganizationId);
    expect(collection?.accessionNumber).toBe("SRC-001");
    expect(collection?.collectionGroupId).toBeUndefined();
    expect(collection?.currentLocationId).toBe(fixture.targetLocationId);
    expect(remainingGroupLinks).toHaveLength(0);
    expect(movedComments[0]?.organizationId).toBe(fixture.targetOrganizationId);
    expect(movedAppraisals[0]?.organizationId).toBe(
      fixture.targetOrganizationId,
    );
    expect(movedCoinsStampsDetails[0]?.organizationId).toBe(
      fixture.targetOrganizationId,
    );
    expect(
      requesterNotifications.some(
        (notification) => notification.type === "move_request_approved",
      ),
    ).toBe(true);
    expect(
      sourceAuditEntries.some(
        (entry) => entry.action === "executed_organization_move_request",
      ),
    ).toBe(true);
    expect(
      targetAuditEntries.some(
        (entry) =>
          entry.action === "received_collection_from_organization_move",
      ),
    ).toBe(true);
    expect(request?.transferScopeSnapshot?.accessionNumberAtTransfer).toBe(
      "SRC-001",
    );
    expect(request?.transferScopeSnapshot?.collectionGroupIds).toContain(
      fixture.collectionGroupId,
    );
    expect(request?.acceptedTargetLocationId).toBe(fixture.targetLocationId);
    expect(request?.approvedSourceLocationId).toBe(fixture.locationId);
    const movementHistory = await fixture.targetAdmin.query(
      api.locations.getCollectionLocationHistory,
      { collectionId: fixture.collectionId },
    );
    const arrival = movementHistory.find(
      (movement) => movement._id === request?.targetArrivalMovementId,
    );
    expect(arrival?.movementKind).toBe("institution_transfer");
    expect(arrival?.authorizedBy).toBe(fixture.targetAdminId);
    expect(arrival?.toLocationId).toBe(fixture.targetLocationId);

    const custodyEvents = await t.run(async (ctx) => {
      return await ctx.db
        .query("organizationTransferCustodyEvents")
        .withIndex("by_moveRequest", (q) => q.eq("moveRequestId", requestId))
        .collect();
    });
    expect(custodyEvents.map((event) => event.phase).sort()).toEqual([
      "source_departure",
      "target_arrival",
    ]);
  });

  test("target acceptance records each source group membership with its canonical role", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const secondaryGroupId = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert("collectionGroups", {
        organizationId: fixture.sourceOrganizationId,
        name: "Secondary Move Group",
        itemsCount: 1,
        createdAt: Date.now(),
        createdBy: fixture.requesterId,
      });
      await ctx.db.insert("collectionGroupItems", {
        collectionGroupId: groupId,
        collectionId: fixture.collectionId,
        role: "secondary",
        addedAt: Date.now(),
        addedBy: fixture.requesterId,
      });
      return groupId;
    });

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Approved move",
      },
    );
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    const request = await t.run(async (ctx) => await ctx.db.get(requestId));
    const memberships =
      request?.transferScopeSnapshot?.collectionGroupMemberships ?? [];

    expect(request?.transferScopeSnapshot?.legacyCollectionGroupId).toBe(
      fixture.collectionGroupId,
    );
    // The fixture's legacy row predates roles: it is retained without a guessed role.
    expect(memberships).toHaveLength(2);
    expect(
      memberships.find(
        (membership) =>
          membership.collectionGroupId === fixture.collectionGroupId,
      ),
    ).toEqual({ collectionGroupId: fixture.collectionGroupId });
    expect(
      memberships.find(
        (membership) => membership.collectionGroupId === secondaryGroupId,
      ),
    ).toEqual({ collectionGroupId: secondaryGroupId, role: "secondary" });
  });

  test("acceptance rejects a stale observed source location", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Stale source check",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });

    const otherLocationId = await t.run(async (ctx) => {
      return await ctx.db.insert("locations", {
        organizationId: fixture.sourceOrganizationId,
        name: "Other shelf",
        locationCode: "OTH-001",
        locationCodeNormalized: "oth-001",
        type: "shelf",
        sortOrder: 1,
        isActive: true,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.collectionId, {
        currentLocationId: otherLocationId,
      });
    });

    await expect(
      fixture.targetAdmin.mutation(api.objectMoves.accept, {
        requestId,
        targetLocationId: fixture.targetLocationId,
      }),
    ).rejects.toThrow(/source location observed/);
  });

  test("replaying accept on an executed transfer is a no-op", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Idempotent accept",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    await expect(
      fixture.targetAdmin.mutation(api.objectMoves.accept, {
        requestId,
        targetLocationId: fixture.targetLocationId,
      }),
    ).resolves.toBeNull();

    const custodyEvents = await t.run(async (ctx) => {
      return await ctx.db
        .query("organizationTransferCustodyEvents")
        .withIndex("by_moveRequest", (q) => q.eq("moveRequestId", requestId))
        .collect();
    });
    expect(custodyEvents).toHaveLength(2);
  });

  test("in-flight acceptance rejects a missing observed source after the object moves", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "In-flight observed source",
      },
    );
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });

    const otherLocationId = await t.run(async (ctx) => {
      await ctx.db.patch(requestId, { approvedSourceLocationId: undefined });
      return await ctx.db.insert("locations", {
        organizationId: fixture.sourceOrganizationId,
        name: "Moved shelf",
        locationCode: "MOV-001",
        locationCodeNormalized: "mov-001",
        type: "shelf",
        sortOrder: 2,
        isActive: true,
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.collectionId, {
        currentLocationId: otherLocationId,
      });
    });

    await expect(
      fixture.targetAdmin.mutation(api.objectMoves.accept, {
        requestId,
        targetLocationId: fixture.targetLocationId,
      }),
    ).rejects.toThrow(/observed source location/);

    const [collection, request] = await Promise.all([
      t.run(async (ctx) => ctx.db.get(fixture.collectionId)),
      t.run(async (ctx) => ctx.db.get(requestId)),
    ]);
    expect(collection?.organizationId).toBe(fixture.sourceOrganizationId);
    expect(collection?.currentLocationId).toBe(otherLocationId);
    expect(request?.status).toBe("awaiting_acceptance");
    expect(request?.approvedSourceLocationId).toBeUndefined();

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    const rebound = await t.run(async (ctx) => ctx.db.get(requestId));
    expect(rebound?.approvedSourceLocationId).toBe(otherLocationId);
    expect(rebound?.status).toBe("awaiting_acceptance");

    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });
    const moved = await t.run(async (ctx) => ctx.db.get(fixture.collectionId));
    expect(moved?.organizationId).toBe(fixture.targetOrganizationId);
    expect(moved?.currentLocationId).toBe(fixture.targetLocationId);
  });

  test("executed accept requires target manage_settings before the idempotent success", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Permission before replay",
      },
    );
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    await expect(
      fixture.admin.mutation(api.objectMoves.accept, {
        requestId,
        targetLocationId: fixture.targetLocationId,
      }),
    ).rejects.toThrow(/Permission denied: organization.manage_settings/);

    await expect(
      fixture.targetAdmin.mutation(api.objectMoves.accept, {
        requestId,
        targetLocationId: fixture.targetLocationId,
      }),
    ).resolves.toBeNull();

    const custodyEvents = await t.run(async (ctx) =>
      ctx.db
        .query("organizationTransferCustodyEvents")
        .withIndex("by_moveRequest", (q) => q.eq("moveRequestId", requestId))
        .collect(),
    );
    expect(custodyEvents).toHaveLength(2);
  });

  test("transfer acceptance rejects a full destination and retains source custody", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Transfer to capacity-limited storage",
      },
    );
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.targetLocationId, { capacity: 1 });
      await ctx.db.insert("collections", {
        organizationId: fixture.targetOrganizationId,
        accessionNumber: "TARGET-OCCUPIED",
        title: "Destination occupant",
        status: "active",
        currentLocationId: fixture.targetLocationId,
        catalogedBy: fixture.adminId,
        catalogedAt: Date.now(),
      });
    });
    await expect(
      fixture.targetAdmin.mutation(api.objectMoves.accept, {
        requestId,
        targetLocationId: fixture.targetLocationId,
      }),
    ).rejects.toThrow(/capacity/i);
    const request = await fixture.admin.query(api.objectMoves.get, {
      requestId,
    });
    expect(request?.status).toBe("awaiting_acceptance");
    expect(request?.targetArrivalMovementId).toBeUndefined();
    const collection = await fixture.admin.query(api.collections.get, {
      collectionId: fixture.collectionId,
    });
    expect(collection?.organizationId).toBe(fixture.sourceOrganizationId);
    expect(collection?.currentLocationId).toBe(fixture.locationId);
  });

  test("acceptance retains condition assessments on the transferred object", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const assessmentId = await t.run(async (ctx) => {
      return await ctx.db.insert("conditionAssessments", {
        organizationId: fixture.sourceOrganizationId,
        collectionId: fixture.collectionId,
        assessedBy: fixture.requesterId,
        assessedAt: Date.now(),
        recordedAt: Date.now(),
        condition: "good",
        summary: "Stable before transfer",
        observations: [],
        photos: [],
        status: "accepted",
      });
    });

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Assessment retention",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    const assessment = await t.run(async (ctx) => {
      return await ctx.db.get(assessmentId);
    });
    expect(assessment?.organizationId).toBe(fixture.targetOrganizationId);
  });

  test("approving a manual accession request updates accession fields and history", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "manual",
        requestedAccessionNumber: "TGT-900",
        reason: "Manual accession move",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, {
      requestId,
      reviewNotes: "Manual accession approved",
    });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
      reviewNotes: "Manual accession accepted",
    });

    const collection = await t.run(async (ctx) => {
      return await ctx.db.get(fixture.collectionId);
    });

    expect(collection?.accessionNumber).toBe("TGT-900");
    expect(collection?.alternateAccessionNumbers).toContain("SRC-001");
    expect(
      collection?.accessionNumberHistory?.some(
        (entry) => entry.number === "SRC-001" && entry.validTo !== undefined,
      ),
    ).toBe(true);
    expect(
      collection?.accessionNumberHistory?.some(
        (entry) => entry.number === "TGT-900" && entry.validTo === undefined,
      ),
    ).toBe(true);
  });

  test("approving an auto accession request generates a new accession number and stores the old one as alternate", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t, {
      targetSettings: {
        autoGenerateAccessionNumbers: true,
        accessionNumberFormat: "TGT-{YYYY}-{###}",
        accessionCounterScope: "year",
      },
    });

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "auto",
        reason: "Auto accession move",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, {
      requestId,
      reviewNotes: "Auto accession approved",
    });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
      reviewNotes: "Auto accession accepted",
    });

    const collection = await t.run(async (ctx) => {
      return await ctx.db.get(fixture.collectionId);
    });

    expect(collection?.accessionNumber).not.toBe("SRC-001");
    expect(collection?.accessionNumber).toMatch(/^TGT-\d{4}-\d{3}$/);
    expect(collection?.alternateAccessionNumbers).toContain("SRC-001");
  });

  test("an auto accession into an organization with a stored bare-token format generates a real number", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t, {
      targetSettings: {
        autoGenerateAccessionNumbers: true,
        accessionNumberFormat: "TGT-YYYY-###",
      },
    });

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "auto",
        reason: "Auto accession move",
      },
    );
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    const collection = await t.run((ctx) => ctx.db.get(fixture.collectionId));
    expect(collection?.accessionNumber).toBe(
      `TGT-${new Date().getFullYear()}-001`,
    );
  });

  test("approving a request moves it from pending to executed in listForOrganization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const [requestId, pendingRequests] = await Promise.all([
      fixture.requester.mutation(api.objectMoves.createRequest, {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Lifecycle approval test",
      }),
      fixture.admin.query(api.objectMoves.listForOrganization, {
        organizationId: fixture.sourceOrganizationId,
        status: "pending_source_approval",
      }),
    ]);
    expect(pendingRequests.some((request) => request._id === requestId)).toBe(
      true,
    );

    await fixture.admin.mutation(api.objectMoves.approve, {
      requestId,
      reviewNotes: "Approved during lifecycle test",
    });

    const incomingRequests = await fixture.targetAdmin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.targetOrganizationId,
        status: "awaiting_acceptance",
      },
    );
    expect(incomingRequests.some((request) => request._id === requestId)).toBe(
      true,
    );

    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
      reviewNotes: "Accepted during lifecycle test",
    });

    const executedRequests = await fixture.admin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.sourceOrganizationId,
        status: "executed",
      },
    );
    expect(executedRequests.some((request) => request._id === requestId)).toBe(
      true,
    );
  });

  test("the transfers column follows a transfer to whichever organization must decide it", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const waitingOn = async () => {
      const [source, target] = await Promise.all([
        workColumn(fixture.admin, fixture.sourceOrganizationId, "transfers"),
        workColumn(
          fixture.targetAdmin,
          fixture.targetOrganizationId,
          "transfers",
        ),
      ]);
      return { source: source?.cards, target: target?.cards };
    };

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Pending transfer card",
      },
    );

    const requested = await waitingOn();
    expect(requested.source).toEqual([
      {
        _id: requestId,
        collectionTitle: "Move Test Object",
        sourceAccessionNumber: "SRC-001",
        direction: "outgoing",
      },
    ]);
    expect(requested.target).toEqual([]);

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });

    const approved = await waitingOn();
    expect(approved.source).toEqual([]);
    expect(approved.target).toMatchObject([
      { _id: requestId, direction: "incoming" },
    ]);

    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    const executed = await waitingOn();
    expect(executed.source).toEqual([]);
    expect(executed.target).toEqual([]);
  });

  test("members who cannot decide transfers see no transfers column", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await fixture.requester.mutation(api.objectMoves.createRequest, {
      collectionId: fixture.collectionId,
      targetOrganizationId: fixture.targetOrganizationId,
      accessionMode: "keep",
      reason: "Requester cannot approve their own transfer",
    });

    const [requesterView, adminView] = await Promise.all([
      workColumn(fixture.requester, fixture.sourceOrganizationId, "transfers"),
      workColumn(fixture.admin, fixture.sourceOrganizationId, "transfers"),
    ]);

    expect(requesterView).toBeUndefined();
    expect(adminView?.cards).toHaveLength(1);
  });

  test("the transfers column counts legacy pending requests and shows the newest first", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestedAt = Date.UTC(2026, 9, 1);

    await t.run(async (ctx) => {
      for (let index = 0; index < 51; index += 1) {
        await ctx.db.insert("organizationMoveRequests", {
          collectionId: fixture.collectionId,
          sourceOrganizationId: fixture.sourceOrganizationId,
          targetOrganizationId: fixture.targetOrganizationId,
          sourceAccessionNumber: `SRC-${index}`,
          accessionMode: "keep",
          reason: "Backlog",
          status: index === 50 ? "pending" : "pending_source_approval",
          requestedBy: fixture.requesterId,
          requestedAt: requestedAt + index,
        });
      }
    });

    const waiting = await workColumn(
      fixture.admin,
      fixture.sourceOrganizationId,
      "transfers",
    );

    expect(waiting?.hasMore).toBe(true);
    expect(waiting?.cards).toHaveLength(20);
    expect(waiting?.cards[0]).toMatchObject({
      sourceAccessionNumber: "SRC-50",
      direction: "outgoing",
    });
    expect(waiting?.cards.at(-1)?.sourceAccessionNumber).toBe("SRC-31");
  });

  test("a transfer approved without an observed source location waits on the source", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizationMoveRequests", {
        collectionId: fixture.collectionId,
        sourceOrganizationId: fixture.sourceOrganizationId,
        targetOrganizationId: fixture.targetOrganizationId,
        sourceAccessionNumber: "SRC-001",
        accessionMode: "keep",
        reason: "Approved before observed source locations",
        status: "awaiting_acceptance",
        requestedBy: fixture.requesterId,
        requestedAt: Date.UTC(2026, 0, 1),
      });
    });

    const [source, target] = await Promise.all([
      workColumn(fixture.admin, fixture.sourceOrganizationId, "transfers"),
      workColumn(
        fixture.targetAdmin,
        fixture.targetOrganizationId,
        "transfers",
      ),
    ]);

    expect(source?.cards).toMatchObject([
      { _id: requestId, direction: "outgoing" },
    ]);
    expect(target?.cards).toEqual([]);
  });

  test("rejecting a request leaves the object unchanged and notifies the requester", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Reject this move",
      },
    );

    await fixture.admin.mutation(api.objectMoves.reject, {
      requestId,
      reviewNotes: "Insufficient transfer documentation",
    });

    const [request, collection, requesterNotifications] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      }),
      t.run(async (ctx) => {
        return await ctx.db.get(fixture.collectionId);
      }),
      t.run(async (ctx) => {
        return await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", fixture.requesterId))
          .collect();
      }),
    ]);
    expect(request?.status).toBe("rejected");
    expect(collection?.organizationId).toBe(fixture.sourceOrganizationId);
    expect(collection?.accessionNumber).toBe("SRC-001");
    expect(
      requesterNotifications.some(
        (notification) =>
          notification.type === "workflow_rejected" &&
          notification.relatedEntityType === "move_request",
      ),
    ).toBe(true);
  });

  test("rejecting a request moves it to rejected in listForOrganization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Lifecycle rejection test",
      },
    );

    await fixture.admin.mutation(api.objectMoves.reject, {
      requestId,
      reviewNotes: "Rejected during lifecycle test",
    });

    const rejectedRequests = await fixture.admin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.sourceOrganizationId,
        status: "rejected",
      },
    );
    expect(rejectedRequests.some((request) => request._id === requestId)).toBe(
      true,
    );
  });

  test("target rejection leaves the object unchanged and appears in source rejected list", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Target may reject this move",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, {
      requestId,
      reviewNotes: "Source approves transfer",
    });
    await fixture.targetAdmin.mutation(api.objectMoves.reject, {
      requestId,
      reviewNotes: "Target cannot accept custody",
    });

    const [request, collection, rejectedRequests] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      }),
      t.run(async (ctx) => {
        return await ctx.db.get(fixture.collectionId);
      }),
      fixture.admin.query(api.objectMoves.listForOrganization, {
        organizationId: fixture.sourceOrganizationId,
        status: "rejected",
      }),
    ]);
    expect(request?.status).toBe("rejected");
    expect(request?.targetReviewNotes).toBe("Target cannot accept custody");
    expect(collection?.organizationId).toBe(fixture.sourceOrganizationId);
    expect(rejectedRequests.some((entry) => entry._id === requestId)).toBe(
      true,
    );
  });

  test("cancelling a pending request leaves the object unchanged", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Cancel this move",
      },
    );

    await fixture.requester.mutation(api.objectMoves.cancel, { requestId });

    const [request, collection] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      }),
      t.run(async (ctx) => {
        return await ctx.db.get(fixture.collectionId);
      }),
    ]);
    expect(request?.status).toBe("cancelled");
    expect(collection?.organizationId).toBe(fixture.sourceOrganizationId);
    expect(collection?.collectionGroupId).toBe(fixture.collectionGroupId);
    expect(collection?.currentLocationId).toBe(fixture.locationId);
  });

  test("cancelling a request moves it to cancelled in listForOrganization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Lifecycle cancellation test",
      },
    );

    await fixture.requester.mutation(api.objectMoves.cancel, { requestId });

    const cancelledRequests = await fixture.admin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.sourceOrganizationId,
        status: "cancelled",
      },
    );
    expect(cancelledRequests.some((request) => request._id === requestId)).toBe(
      true,
    );
  });

  test("lookupTransferDestinationByAccountNumber rejects destinations that disallow incoming transfers", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const closedDestinationId = await createOrganization(
      t,
      "Closed Destination",
      `closed-${Math.random().toString(36).slice(2, 8)}`,
      { allowIncomingTransferRequests: false },
      { accountNumber: "ORG-00042", allowsIncomingTransferRequests: false },
    );

    const lookup = await fixture.requester.query(
      api.objectMoves.lookupTransferDestinationByAccountNumber,
      {
        collectionId: fixture.collectionId,
        accountNumber: "ORG-00042",
      },
    );

    expect(lookup.status).toBe("invalid");
    if (lookup.status === "invalid") {
      expect(lookup.message).toContain("not accepting incoming transfer");
    }
    expect(closedDestinationId).toBeDefined();
  });

  test("lookupTransferDestinationByAccountNumber accepts public destinations", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const publicDestinationId = await createOrganization(
      t,
      "Public Destination Museum",
      `public-${Math.random().toString(36).slice(2, 8)}`,
      { allowIncomingTransferRequests: true },
      { accountNumber: "ORG-00099", allowsIncomingTransferRequests: true },
    );

    const lookup = await fixture.requester.query(
      api.objectMoves.lookupTransferDestinationByAccountNumber,
      {
        collectionId: fixture.collectionId,
        accountNumber: "ORG-00099",
      },
    );

    expect(lookup).toEqual({
      status: "valid",
      organization: {
        _id: publicDestinationId,
        name: "Public Destination Museum",
        slug: expect.any(String),
        accountNumber: "ORG-00099",
        source: "public",
      },
    });
  });

  test("createRequest allows public destinations without target membership", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const publicDestinationId = await createOrganization(
      t,
      "External Receiver",
      `external-${Math.random().toString(36).slice(2, 8)}`,
      { allowIncomingTransferRequests: true },
      { accountNumber: "ORG-00123", allowsIncomingTransferRequests: true },
    );

    const eligibility = await fixture.requester.query(
      api.objectMoves.getEligibility,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: publicDestinationId,
      },
    );
    expect(eligibility.isEligible).toBe(true);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: publicDestinationId,
        accessionMode: "keep",
        reason: "Transfer to external organization",
      },
    );

    const request = await t.run(async (ctx) => {
      return await ctx.db.get(requestId);
    });
    expect(request?.targetOrganizationId).toBe(publicDestinationId);
    expect(request?.status).toBe("pending_source_approval");
  });

  test("searchTransferDestinations finds organizations by account number", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    await createOrganization(
      t,
      "Searchable Public Museum",
      `searchable-${Math.random().toString(36).slice(2, 8)}`,
      { allowIncomingTransferRequests: true },
      { accountNumber: "ORG-00456", allowsIncomingTransferRequests: true },
    );

    const results = await fixture.requester.query(
      api.objectMoves.searchTransferDestinations,
      {
        collectionId: fixture.collectionId,
        query: "ORG-00456",
      },
    );

    expect(results.some((entry) => entry.accountNumber === "ORG-00456")).toBe(
      true,
    );
  });
});

async function createPublicDestination(
  t: ReturnType<typeof convexTest>,
  accountNumber: string,
) {
  const [organizationId, adminId] = await Promise.all([
    createOrganization(
      t,
      "Public Receiver",
      `public-receiver-${Math.random().toString(36).slice(2, 8)}`,
      { allowIncomingTransferRequests: true },
      { accountNumber, allowsIncomingTransferRequests: true },
    ),
    createUser(
      t,
      "Receiver Admin",
      `receiver-admin-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    ),
  ]);
  const [roleId, locationId] = await Promise.all([
    createRoleWithPermissions(
      t,
      organizationId,
      [
        "organization.manage_settings",
        "collections.read",
        "collections.create",
      ],
      "Receiver Admin Role",
    ),
    createLocation(t, organizationId),
  ]);
  await addMembership(t, adminId, organizationId, roleId);
  return {
    organizationId,
    locationId,
    admin: authedForUser(t, adminId),
  };
}

describe("transfer decisions follow how the request was allowed", () => {
  test("a transfer to a public destination outside the hierarchy can be approved and accepted", async () => {
    const t = convexTest(schema, modules);
    const [fixture, destination] = await Promise.all([
      createMoveFixture(t),
      createPublicDestination(t, "ORG-00815"),
    ]);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: destination.organizationId,
        accessionMode: "keep",
        reason: "Transfer to a museum that accepts incoming transfers",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    expect((await t.run((ctx) => ctx.db.get(requestId)))?.status).toBe(
      "awaiting_acceptance",
    );

    await destination.admin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: destination.locationId,
    });
    const [request, collection] = await Promise.all([
      t.run((ctx) => ctx.db.get(requestId)),
      t.run((ctx) => ctx.db.get(fixture.collectionId)),
    ]);
    expect(request?.status).toBe("executed");
    expect(collection?.organizationId).toBe(destination.organizationId);
    expect(collection?.currentLocationId).toBe(destination.locationId);
  });

  test("a public destination inside a hierarchy without a Pro plan can be approved", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.sourceOrganizationId, {
        subscriptionTier: "free",
      });
      await ctx.db.patch(fixture.targetOrganizationId, {
        allowsIncomingTransferRequests: true,
      });
    });
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Sibling accepts incoming transfers",
      },
    );

    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    expect((await t.run((ctx) => ctx.db.get(requestId)))?.status).toBe(
      "executed",
    );
  });

  test("approval and acceptance refuse a destination that stopped allowing incoming transfers, with a code", async () => {
    const t = convexTest(schema, modules);
    const [fixture, destination] = await Promise.all([
      createMoveFixture(t),
      createPublicDestination(t, "ORG-00816"),
    ]);
    const closeDestination = (open: boolean) =>
      t.run(async (ctx) => {
        await ctx.db.patch(destination.organizationId, {
          allowsIncomingTransferRequests: open,
          settings: { allowIncomingTransferRequests: open },
        });
      });
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: destination.organizationId,
        accessionMode: "keep",
        reason: "Destination closes before approval",
      },
    );

    await closeDestination(false);
    expect(
      await refusal(
        fixture.admin.mutation(api.objectMoves.approve, { requestId }),
      ),
    ).toMatchObject({ code: "DESTINATION_OUTSIDE_HIERARCHY" });

    await closeDestination(true);
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await closeDestination(false);
    expect(
      await refusal(
        destination.admin.mutation(api.objectMoves.accept, {
          requestId,
          targetLocationId: destination.locationId,
        }),
      ),
    ).toMatchObject({ code: "DESTINATION_OUTSIDE_HIERARCHY" });
    expect(
      (await t.run((ctx) => ctx.db.get(fixture.collectionId)))?.organizationId,
    ).toBe(fixture.sourceOrganizationId);
  });

  test("approval refuses a hierarchy transfer once the plan no longer includes it, with a code", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Plan changes before approval",
      },
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.sourceOrganizationId, {
        subscriptionTier: "free",
      });
    });

    expect(
      await refusal(
        fixture.admin.mutation(api.objectMoves.approve, { requestId }),
      ),
    ).toMatchObject({ code: "HIERARCHY_PLAN_REQUIRED" });
  });

  test("approval names what started blocking the object after the request, with a code", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Object goes on loan before approval",
      },
    );
    await t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        organizationId: fixture.sourceOrganizationId,
        loanNumber: "LN-815",
        type: "outgoing",
        lenderBorrowerName: "Borrower",
        startDate: Date.now(),
        status: "active",
      });
      await ctx.db.insert("loanItems", {
        loanId,
        collectionId: fixture.collectionId,
      });
    });

    expect(
      await refusal(
        fixture.admin.mutation(api.objectMoves.approve, { requestId }),
      ),
    ).toEqual({
      code: "MOVE_BLOCKED",
      message: "This object is currently on loan and cannot be moved.",
      blockers: ["active_loan"],
    });
    expect((await t.run((ctx) => ctx.db.get(requestId)))?.status).toBe(
      "pending_source_approval",
    );
  });

  test("a decided request refuses another decision with a code", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Decided twice",
      },
    );
    await fixture.admin.mutation(api.objectMoves.cancel, { requestId });

    const refusals = await Promise.all([
      refusal(fixture.admin.mutation(api.objectMoves.approve, { requestId })),
      refusal(
        fixture.targetAdmin.mutation(api.objectMoves.accept, {
          requestId,
          targetLocationId: fixture.targetLocationId,
        }),
      ),
      refusal(
        fixture.admin.mutation(api.objectMoves.reject, {
          requestId,
          reviewNotes: "Too late",
        }),
      ),
      refusal(
        fixture.requester.mutation(api.objectMoves.cancel, { requestId }),
      ),
    ]);
    expect(refusals.map((entry) => entry?.code)).toEqual([
      "MOVE_REQUEST_CLOSED",
      "MOVE_REQUEST_CLOSED",
      "MOVE_REQUEST_CLOSED",
      "MOVE_REQUEST_CLOSED",
    ]);
  });

  test("a source administrator who did not make the request can cancel it", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Administrator stops this request",
      },
    );

    await fixture.admin.mutation(api.objectMoves.cancel, { requestId });

    const [request, requesterNotifications] = await Promise.all([
      t.run((ctx) => ctx.db.get(requestId)),
      notificationsFor(t, fixture.requesterId),
    ]);
    expect(request?.status).toBe("cancelled");
    expect(request?.sourceReviewedBy).toBe(fixture.adminId);
    expect(request?.sourceReviewNotes).toBeUndefined();
    expect(
      requesterNotifications
        .filter(
          (notification) => notification.type === "move_request_cancelled",
        )
        .map(({ title, message }) => ({ title, message })),
    ).toEqual([
      {
        title: "Object Move Cancelled",
        message:
          "Your object move request was cancelled by an administrator of the source organization.",
      },
    ]);
  });

  test("a source administrator's cancel notes are kept and sent to the requester", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Administrator stops this request",
      },
    );

    await fixture.admin.mutation(api.objectMoves.cancel, {
      requestId,
      reviewNotes: "  Duplicate of an earlier transfer request.  ",
    });

    const [request, requesterNotifications, auditEntries] = await Promise.all([
      t.run((ctx) => ctx.db.get(requestId)),
      notificationsFor(t, fixture.requesterId),
      t.run((ctx) =>
        ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", fixture.sourceOrganizationId),
          )
          .collect(),
      ),
    ]);
    expect(request).toMatchObject({
      status: "cancelled",
      reviewedBy: fixture.adminId,
      reviewNotes: "Duplicate of an earlier transfer request.",
      sourceReviewedBy: fixture.adminId,
      sourceReviewNotes: "Duplicate of an earlier transfer request.",
    });
    expect(
      auditEntries.find(
        (entry) => entry.action === "cancelled_organization_move_request",
      )?.changes,
    ).toEqual({ reviewNotes: "Duplicate of an earlier transfer request." });
    expect(
      requesterNotifications
        .filter(
          (notification) => notification.type === "move_request_cancelled",
        )
        .map(({ title, message }) => ({ title, message })),
    ).toEqual([
      {
        title: "Object Move Cancelled",
        message: "Duplicate of an earlier transfer request.",
      },
    ]);
  });

  test("a requester cancelling their own request notifies nobody", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Requester changes their mind",
      },
    );

    await fixture.requester.mutation(api.objectMoves.cancel, { requestId });

    const notifications = await Promise.all(
      [fixture.requesterId, fixture.adminId, fixture.targetAdminId].map(
        (userId) => notificationsFor(t, userId),
      ),
    );
    expect(
      notifications
        .flat()
        .filter(
          (notification) => notification.type === "move_request_cancelled",
        ),
    ).toEqual([]);
  });
});

describe("organization transfer registry", () => {
  test("backfillOrganizationTransferFields assigns ORG account numbers", async () => {
    const t = convexTest(schema, modules);
    const legacyOrgId = await createOrganization(
      t,
      "Legacy Museum",
      `legacy-${Math.random().toString(36).slice(2, 8)}`,
    );

    const before = await t.run(async (ctx) => ctx.db.get(legacyOrgId));
    expect(before?.accountNumber).toBeUndefined();

    const result = await t.mutation(
      internal.migrations.backfillOrganizationTransferFields,
      {},
    );

    expect(result.accountNumbersAssigned).toBeGreaterThanOrEqual(1);

    const after = await t.run(async (ctx) => ctx.db.get(legacyOrgId));
    expect(after?.accountNumber).toMatch(/^ORG-\d{5}$/);
    expect(after?.allowsIncomingTransferRequests).toBe(false);
  });
});

describe("object move projections", () => {
  test("an accepted organization transfer moves the object's usage contribution between organizations in the same transaction", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);
    await rebuildProjection(t, fixture.sourceOrganizationId);
    await rebuildProjection(t, fixture.targetOrganizationId);
    const usage = async () => [
      (
        await fixture.admin.query(api.organizations.getUsageStats, {
          organizationId: fixture.sourceOrganizationId,
        })
      ).objects.used,
      (
        await fixture.targetAdmin.query(api.organizations.getUsageStats, {
          organizationId: fixture.targetOrganizationId,
        })
      ).objects.used,
    ];
    expect(await usage()).toEqual([1, 0]);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Projection parity",
      },
    );
    await fixture.admin.mutation(api.objectMoves.approve, { requestId });
    await fixture.targetAdmin.mutation(api.objectMoves.accept, {
      requestId,
      targetLocationId: fixture.targetLocationId,
    });

    expect(await usage()).toEqual([0, 1]);
  });
});
