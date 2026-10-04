import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import schema from "./schema";

test("collections.list hides deleted and deaccession workflow objects by default", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId } = await t.run(async (ctx) => {
    const [userId, organizationId, collectionsReadPermissionId] =
      await Promise.all([
        ctx.db.insert("users", { name: "Test User" }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org",
          type: "museum",
        }),
        ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
          description: "Read collections",
        }),
      ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      description: "Test role",
      isSystemRole: false,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: collectionsReadPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0001",
      title: "Active item",
      displayStatus: "on_display",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    const pendingDeaccessionCollectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0002",
      title: "Pending deaccession item",
      displayStatus: "on_display",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0003",
      title: "Stored active item",
      displayStatus: "in_storage",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "D-0001",
      title: "Deaccessioned item",
      status: "deaccessioned",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "X-0001",
      title: "Deleted item",
      status: "deleted",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "R-0001",
      title: "Withdrawn item",
      status: "archived",
      archivedAt: Date.now(),
      archivedReason: "Duplicate catalog record",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await ctx.db.insert("deaccessions", {
      organizationId,
      collectionId: pendingDeaccessionCollectionId,
      deaccessionNumber: "DA-TES-2026-001",
      dateDeaccessioned: Date.now(),
      reason: "Duplicate entry",
      method: "destruction",
      status: "pending",
      workflowStep: 1,
      workflowHistory: [],
    });

    return { organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  const defaultList = await asUser.query(api.collections.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(new Set(defaultList.page.map((c) => c.title))).toEqual(
    new Set(["Active item", "Stored active item"]),
  );

  const includeAll = await asUser.query(api.collections.list, {
    organizationId,
    includeDeaccessioned: true,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(new Set(includeAll.page.map((c) => c.title))).toEqual(
    new Set(["Active item", "Deaccessioned item", "Stored active item"]),
  );

  const onlyDeaccessioned = await asUser.query(api.collections.list, {
    organizationId,
    status: "deaccessioned",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(onlyDeaccessioned.page.map((c) => c.status)).toEqual([
    "deaccessioned",
  ]);

  const onlyDeleted = await asUser.query(api.collections.list, {
    organizationId,
    status: "deleted",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(onlyDeleted.page.map((c) => c.status)).toEqual(["deleted"]);

  const archiveView = await asUser.query(api.collections.list, {
    organizationId,
    status: "archived",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(archiveView.page.map((c) => c.title)).toEqual(["Withdrawn item"]);

  const onlyActive = await asUser.query(api.collections.list, {
    organizationId,
    status: "active",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(new Set(onlyActive.page.map((c) => c.title))).toEqual(
    new Set(["Active item", "Stored active item"]),
  );

  const activeOnDisplay = await asUser.query(api.collections.list, {
    organizationId,
    status: "active",
    displayStatus: "on_display",
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(activeOnDisplay.page.map((c) => c.title)).toEqual(["Active item"]);
});

test("collections.list paginates newest objects and enriches visible rows", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId } = await t.run(async (ctx) => {
    const [userId, organizationId, collectionsReadPermissionId] =
      await Promise.all([
        ctx.db.insert("users", { name: "Test User" }),
        ctx.db.insert("organizations", {
          name: "Paged Org",
          slug: "paged-org",
          type: "museum",
        }),
        ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
          description: "Read collections",
        }),
      ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      description: "Test role",
      isSystemRole: false,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: collectionsReadPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const buildingId = await ctx.db.insert("locations", {
      organizationId,
      name: "Building A",
      type: "building",
      sortOrder: 0,
      isActive: true,
    });
    const shelfId = await ctx.db.insert("locations", {
      organizationId,
      name: "Shelf 1",
      type: "shelf",
      parentLocationId: buildingId,
      sortOrder: 0,
      isActive: true,
    });

    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0001",
      title: "Old item",
      status: "active",
      catalogedBy: userId,
      catalogedAt: 1,
      currentLocationId: shelfId,
    });
    await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0002",
      title: "Middle item",
      status: "active",
      catalogedBy: userId,
      catalogedAt: 2,
      objectType: "Painting",
    });
    const [newestCollectionId, storageId] = await Promise.all([
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "A-0003",
        title: "Newest item",
        status: "active",
        catalogedBy: userId,
        catalogedAt: 3,
        objectType: "Sculpture",
        currentLocationId: shelfId,
      }),
      ctx.storage.store(
        new Blob([new Uint8Array([0xff])], { type: "image/jpeg" }),
      ),
    ]);
    await ctx.db.insert("mediaFiles", {
      collectionId: newestCollectionId,
      organizationId,
      storageId,
      fileName: "newest.jpg",
      fileType: "image",
      fileSize: 1,
      mimeType: "image/jpeg",
      mediaCategory: "image",
      isPrimary: true,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });

    return { organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  const firstPage = await asUser.query(api.collections.list, {
    organizationId,
    paginationOpts: { numItems: 2, cursor: null },
  });
  expect(firstPage.page.map((c) => c.title)).toEqual([
    "Newest item",
    "Middle item",
  ]);
  expect(Object.keys(firstPage).sort()).toEqual([
    "continueCursor",
    "isDone",
    "page",
  ]);
  expect(firstPage.isDone).toBe(false);
  expect(firstPage.page[0]?.locationPath).toBe("Building A > Shelf 1");
  expect(firstPage.page[0]?.primaryImageUrl).toEqual(expect.any(String));

  const secondPage = await asUser.query(api.collections.list, {
    organizationId,
    paginationOpts: {
      numItems: 2,
      cursor: firstPage.continueCursor,
    },
  });
  expect(secondPage.page.map((c) => c.title)).toEqual(["Old item"]);
  expect(secondPage.isDone).toBe(true);

  const statusFiltered = await asUser.query(api.collections.list, {
    organizationId,
    status: "active",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(statusFiltered.page.map((c) => c.status)).toEqual([
    "active",
    "active",
    "active",
  ]);

  const typeFiltered = await asUser.query(api.collections.list, {
    organizationId,
    objectType: "Painting",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(typeFiltered.page.map((c) => c.title)).toEqual(["Middle item"]);
});

test("collections archive retains register evidence and restore rejects conflicting active identity", async () => {
  const t = convexTest(schema, modules);

  const {
    organizationId,
    userId,
    collectionId,
    accessionId,
    mediaId,
    readPermissionId,
  } = await t.run(async (ctx) => {
    const [userId, organizationId, readPermissionId, deletePermissionId] =
      await Promise.all([
        ctx.db.insert("users", { name: "Test User" }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org-archive",
          type: "museum",
        }),
        ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
          description: "Read collections",
        }),
        ctx.db.insert("permissions", {
          name: "collections.delete",
          category: "collections",
          description: "Withdraw collections",
        }),
      ]);
    const updatePermissionId = await ctx.db.insert("permissions", {
      name: "collections.update",
      category: "collections",
      description: "Restore collections",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Collection Manager",
      description: "Test role",
      isSystemRole: false,
    });
    await Promise.all(
      [readPermissionId, deletePermissionId, updatePermissionId].map(
        (permissionId) =>
          ctx.db.insert("rolePermissions", { roleId, permissionId }),
      ),
    );
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0001",
      title: "Withdrawn item",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    const accessionId = await ctx.db.insert("accessions", {
      organizationId,
      collectionId,
      accessionNumber: "A-0001",
      dateReceived: Date.now(),
      source: "Historic register",
      method: "gift",
      status: "approved",
    });
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([0xff])], { type: "image/jpeg" }),
    );
    const mediaId = await ctx.db.insert("mediaFiles", {
      organizationId,
      collectionId,
      storageId,
      fileName: "register-photo.jpg",
      fileType: "image/jpeg",
      fileSize: 1,
      mimeType: "image/jpeg",
      mediaCategory: "image",
      isPrimary: true,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
    await ctx.db.insert("conservationTreatments", {
      organizationId,
      collectionId,
      title: "Retained treatment record",
      description: "Historic care evidence",
      treatmentType: "assessment",
      performedBy: userId,
      performedAt: Date.now(),
      status: "completed",
      createdBy: userId,
    });

    return {
      organizationId,
      userId,
      collectionId,
      accessionId,
      mediaId,
      readPermissionId,
    };
  });

  const asUser = t.withIdentity({ subject: userId });
  const readOnlyUserId = await t.run(async (ctx) => {
    const [readOnlyUserId, roleId] = await Promise.all([
      ctx.db.insert("users", { name: "Read Only User" }),
      ctx.db.insert("roles", {
        organizationId,
        name: "Reader",
        description: "Read-only role",
        isSystemRole: false,
      }),
    ]);
    await Promise.all([
      ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: readPermissionId,
      }),
      ctx.db.insert("userOrganizations", {
        userId: readOnlyUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      }),
    ]);
    return readOnlyUserId;
  });
  const readOnlyUser = t.withIdentity({ subject: readOnlyUserId });

  await expect(
    readOnlyUser.mutation(api.collections.archiveCollection, {
      collectionId,
      reason: "Duplicate catalog record",
    }),
  ).rejects.toThrow("Permission denied");

  await expect(
    asUser.mutation(api.collections.archiveCollection, {
      collectionId,
      reason: "   ",
    }),
  ).rejects.toThrow("Reason is required");

  await asUser.mutation(api.collections.archiveCollection, {
    collectionId,
    reason: "Duplicate catalog record",
  });
  await expect(
    asUser.mutation(api.collections.archiveCollection, {
      collectionId,
      reason: "Duplicate catalog record",
    }),
  ).resolves.toBeNull();

  const archiveRegister = await asUser.query(api.collections.getObjectDetail, {
    collectionId,
  });
  expect(archiveRegister?.collection.archivedReason).toBe(
    "Duplicate catalog record",
  );
  await expect(
    readOnlyUser.mutation(api.collections.restoreCollection, { collectionId }),
  ).rejects.toThrow("Permission denied");

  await t.run(async (ctx) => {
    const collection = await ctx.db.get(collectionId);
    expect(collection?.status).toBe("archived");
    expect(collection?.archivedReason).toBe("Duplicate catalog record");
    await expect(ctx.db.get(accessionId)).resolves.not.toBeNull();
    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    expect(treatments).toHaveLength(1);
    await expect(ctx.db.get(mediaId)).resolves.not.toBeNull();
  });

  const competingCollectionId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-0001",
      title: "Conflicting active item",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    }),
  );
  await expect(
    asUser.mutation(api.collections.restoreCollection, { collectionId }),
  ).rejects.toThrow("An active object already uses this accession number");

  await t.run((ctx) => ctx.db.delete(competingCollectionId));
  await expect(
    asUser.mutation(api.collections.restoreCollection, { collectionId }),
  ).resolves.toBeNull();

  await t.run(async (ctx) => {
    const restoreLog = await ctx.db
      .query("auditLog")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("action"), "restored_collection"),
          q.eq(q.field("entityId"), collectionId),
        ),
      )
      .first();
    expect(restoreLog?.changes).toMatchObject({
      withdrawalReason: "Duplicate catalog record",
    });
  });
});

test("collections.create rejects module collection types when module is disabled", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId } = await t.run(async (ctx) => {
    const [userId, organizationId, createPermissionId, readPermissionId] =
      await Promise.all([
        ctx.db.insert("users", { name: "Test User" }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org-create",
          type: "museum",
          settings: {
            enabledModules: [],
          },
        }),
        ctx.db.insert("permissions", {
          name: "collections.create",
          category: "collections",
          description: "Create collections",
        }),
        ctx.db.insert("permissions", {
          name: "collections.read",
          category: "collections",
          description: "Read collections",
        }),
      ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Manager",
      description: "Test role",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: createPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  await expect(
    asUser.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "W-0001",
      title: "Wine Object",
      collectionType: "wine",
    }),
  ).rejects.toThrow("Collection type requires enabled module");
});

test("coins and stamps details require enabled module and surface in module details", async () => {
  const t = convexTest(schema, modules);

  const { userId, collectionId } = await t.run(async (ctx) => {
    const [
      userId,
      organizationId,
      createPermissionId,
      readPermissionId,
      updatePermissionId,
    ] = await Promise.all([
      ctx.db.insert("users", { name: "Test User" }),
      ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org-coins-stamps",
        type: "museum",
        settings: {
          enabledModules: ["coins_stamps"],
        },
      }),
      ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
        description: "Create collections",
      }),
      ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
        description: "Read collections",
      }),
      ctx.db.insert("permissions", {
        name: "collections.update",
        category: "collections",
        description: "Update collections",
      }),
    ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Manager",
      description: "Test role",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: createPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: updatePermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "CS-0001",
      title: "Penny Black",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
      collectionType: "coins_stamps",
    });

    return { collectionId, organizationId, userId };
  });

  const asUser = t.withIdentity({ subject: userId });

  const [detailsId, details] = await Promise.all([
    asUser.mutation(api.coinsStampsDetails.upsert, {
      collectionId,
      itemCategory: "stamp",
      issuingAuthority: "United Kingdom",
      countryOrRegion: "Great Britain",
      denomination: "1d",
      issueYear: 1840,
      catalogNumber: "SG 2",
      grade: "Fine used",
      estimatedValue: 250,
    }),
    asUser.query(api.coinsStampsDetails.get, {
      collectionId,
    }),
  ]);
  expect(details?._id).toEqual(detailsId);
  expect(details?.catalogNumber).toBe("SG 2");

  const withDetails = await asUser.query(api.collections.getWithModuleDetails, {
    collectionId,
  });
  const moduleDetails = withDetails?.moduleDetails;
  expect(moduleDetails?.type).toBe("coins_stamps");
  if (!moduleDetails || moduleDetails.type !== "coins_stamps") {
    throw new Error("Expected coins and stamps module details");
  }
  expect(moduleDetails.data.catalogNumber).toBe("SG 2");
});

test("collections.getWithModuleDetails allows collections.read", async () => {
  const t = convexTest(schema, modules);

  const { organizationId, userId, collectionId } = await t.run(async (ctx) => {
    const [userId, organizationId, readPermissionId] = await Promise.all([
      ctx.db.insert("users", { name: "Test User" }),
      ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org-read-view-alias",
        type: "museum",
      }),
      ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
        description: "Read collections",
      }),
    ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      description: "Read-only role",
      isSystemRole: false,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: readPermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "R-0001",
      title: "Read Alias Object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { organizationId, userId, collectionId };
  });

  const asUser = t.withIdentity({ subject: userId });
  const result = await asUser.query(api.collections.getWithModuleDetails, {
    collectionId,
  });

  expect(result?.collection._id).toEqual(collectionId);
  expect(result?.collection.organizationId).toEqual(organizationId);
});

test("collections.get requires collections.read permission", async () => {
  const t = convexTest(schema, modules);

  const { collectionId, userWithoutPermissionId } = await t.run(async (ctx) => {
    const [ownerId, userWithoutPermissionId, organizationId] =
      await Promise.all([
        ctx.db.insert("users", { name: "Owner User" }),
        ctx.db.insert("users", {
          name: "No Permission User",
        }),
        ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-org-no-read",
          type: "museum",
        }),
      ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "NoReadRole",
      description: "Role without collection read",
      isSystemRole: false,
    });

    await ctx.db.insert("userOrganizations", {
      userId: userWithoutPermissionId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "NR-0001",
      title: "No Read Object",
      status: "active",
      catalogedBy: ownerId,
      catalogedAt: Date.now(),
    });

    return { collectionId, userWithoutPermissionId };
  });

  const asUnauthorizedUser = t.withIdentity({
    subject: userWithoutPermissionId,
  });
  await expect(
    asUnauthorizedUser.query(api.collections.get, { collectionId }),
  ).rejects.toThrow("Permission denied: collections.read");
});
