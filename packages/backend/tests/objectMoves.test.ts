import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api.js";
import type { Id } from "../convex/_generated/dataModel.js";
import schema from "../convex/schema.js";
import { modules } from "./testSetup.js";

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
  },
  hierarchy?: {
    parentOrganizationId?: Id<"organizations">;
    rootOrganizationId?: Id<"organizations">;
    subscriptionTier?: "free" | "pro" | "enterprise";
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name,
      slug,
      type: "museum",
      settings,
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
  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: roleName,
      isSystemRole: false,
    });
  });

  const permissionIds = await Promise.all(
    [...new Set(permissionNames)].map((permissionName) =>
      t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: permissionName,
          category: getPermissionCategory(permissionName),
        });
      }),
    ),
  );

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
  const requesterId = await createUser(
    t,
    "Requester",
    `requester-${Math.random().toString(36).slice(2, 8)}@test.dev`,
  );
  const adminId = await createUser(
    t,
    "Admin",
    `admin-${Math.random().toString(36).slice(2, 8)}@test.dev`,
  );
  const targetAdminId = await createUser(
    t,
    "Target Admin",
    `target-admin-${Math.random().toString(36).slice(2, 8)}@test.dev`,
  );

  const sourceOrganizationId = await createOrganization(
    t,
    "Source Museum",
    `source-${Math.random().toString(36).slice(2, 8)}`,
    undefined,
    { subscriptionTier: "pro" },
  );
  const targetOrganizationId = await createOrganization(
    t,
    "Target Museum",
    `target-${Math.random().toString(36).slice(2, 8)}`,
    options?.targetSettings,
    {
      parentOrganizationId: sourceOrganizationId,
      rootOrganizationId: sourceOrganizationId,
    },
  );

  const requesterSourceRoleId = await createRoleWithPermissions(
    t,
    sourceOrganizationId,
    ["collections.create", "collections.update", "collections.read"],
    "Requester Source Role",
  );
  const requesterTargetRoleId = await createRoleWithPermissions(
    t,
    targetOrganizationId,
    ["collections.create", "collections.read"],
    "Requester Target Role",
  );
  const adminRoleId = await createRoleWithPermissions(
    t,
    sourceOrganizationId,
    ["organization.manage_settings", "collections.read"],
    "Source Admin Role",
  );
  const targetAdminRoleId = await createRoleWithPermissions(
    t,
    targetOrganizationId,
    ["organization.manage_settings", "collections.read", "collections.create"],
    "Target Admin Role",
  );

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

  const collectionGroupId = await createCollectionGroup(
    t,
    sourceOrganizationId,
    requesterId,
  );
  const locationId = await createLocation(t, sourceOrganizationId);
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
    const fixture = await createMoveFixture(t);
    const externalOrganizationId = await createOrganization(
      t,
      "External Museum",
      `external-${Math.random().toString(36).slice(2, 8)}`,
      undefined,
      { subscriptionTier: "pro" },
    );
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
    const requesterId = await createUser(
      t,
      "Requester",
      `solo-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    );
    const sourceOrganizationId = await createOrganization(
      t,
      "Source Museum",
      `source-${Math.random().toString(36).slice(2, 8)}`,
    );
    const targetOrganizationId = await createOrganization(
      t,
      "Target Museum",
      `target-${Math.random().toString(36).slice(2, 8)}`,
    );

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

    for (const search of matchingSearches) {
      const result = await fixture.admin.query(
        api.objectMoves.listForOrganization,
        {
          organizationId: fixture.sourceOrganizationId,
          search,
        },
      );
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(requests[0]?._id);
    }
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
    expect(collection?.currentLocationId).toBeUndefined();
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
      reviewNotes: "Auto accession accepted",
    });

    const collection = await t.run(async (ctx) => {
      return await ctx.db.get(fixture.collectionId);
    });

    expect(collection?.accessionNumber).not.toBe("SRC-001");
    expect(collection?.accessionNumber).toMatch(/^TGT-\d{4}-\d{3}$/);
    expect(collection?.alternateAccessionNumbers).toContain("SRC-001");
  });

  test("approving a request moves it from pending to executed in listForOrganization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createMoveFixture(t);

    const requestId = await fixture.requester.mutation(
      api.objectMoves.createRequest,
      {
        collectionId: fixture.collectionId,
        targetOrganizationId: fixture.targetOrganizationId,
        accessionMode: "keep",
        reason: "Lifecycle approval test",
      },
    );

    const pendingRequests = await fixture.admin.query(
      api.objectMoves.listForOrganization,
      {
        organizationId: fixture.sourceOrganizationId,
        status: "pending_source_approval",
      },
    );
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
});
