import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setup() {
  const t = createConvexTest();
  const permissions = [
    "collections.read",
    "collections.create",
    "collections.update",
  ];
  const owner = await createOrgUserWithPermissions(t, permissions);
  const other = await createOrgUserWithPermissions(t, permissions);
  const records = await t.run(async (ctx) => {
    const collection = {
      organizationId: owner.organizationId,
      title: "Own object",
      status: "active" as const,
      catalogedAt: Date.now(),
      catalogedBy: owner.userId,
    };
    const parentId = await ctx.db.insert("collections", {
      ...collection,
      accessionNumber: "PARENT",
    });
    const childId = await ctx.db.insert("collections", {
      ...collection,
      accessionNumber: "CHILD",
      parentObjectId: parentId,
    });
    const siblingId = await ctx.db.insert("collections", {
      ...collection,
      accessionNumber: "SIBLING",
      parentObjectId: parentId,
    });
    const foreignId = await ctx.db.insert("collections", {
      ...collection,
      organizationId: other.organizationId,
      accessionNumber: "FOREIGN",
      parentObjectId: parentId,
    });
    const corruptChildId = await ctx.db.insert("collections", {
      ...collection,
      accessionNumber: "CORRUPT-CHILD",
      parentObjectId: foreignId,
    });
    const location = {
      name: "Storage",
      type: "room",
      sortOrder: 0,
      isActive: true,
    };
    const locationId = await ctx.db.insert("locations", {
      ...location,
      organizationId: owner.organizationId,
    });
    const foreignLocationId = await ctx.db.insert("locations", {
      ...location,
      organizationId: other.organizationId,
    });
    const groupId = await ctx.db.insert("collectionGroups", {
      organizationId: owner.organizationId,
      name: "Own group",
      storageLocation: "West wing",
      createdAt: Date.now(),
      createdBy: owner.userId,
      managedByRoleId: owner.roleId,
      curatorId: owner.userId,
    });
    const noPermissionUserId = await ctx.db.insert("users", {
      name: "No permission",
    });
    const noPermissionRoleId = await ctx.db.insert("roles", {
      organizationId: owner.organizationId,
      name: "No permission",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId: noPermissionUserId,
      organizationId: owner.organizationId,
      roleId: noPermissionRoleId,
      joinedAt: Date.now(),
    });
    const missingCollectionId = await ctx.db.insert("collections", {
      ...collection,
      accessionNumber: "MISSING",
    });
    await ctx.db.delete(missingCollectionId);
    const missingGroupId = await ctx.db.insert("collectionGroups", {
      organizationId: owner.organizationId,
      name: "Missing group",
      createdAt: Date.now(),
      createdBy: owner.userId,
    });
    await ctx.db.delete(missingGroupId);
    return {
      parentId,
      childId,
      siblingId,
      foreignId,
      corruptChildId,
      locationId,
      foreignLocationId,
      groupId,
      missingCollectionId,
      missingGroupId,
      noPermissionUserId,
    };
  });
  return {
    t,
    owner,
    other,
    ...records,
    authed: authedForUser(t, owner.userId),
    outsider: authedForUser(t, other.userId),
    noPermission: authedForUser(t, records.noPermissionUserId),
  };
}

const relationOracles = [
  ["parent", api.collections.getParentObject, null],
  ["parent thumbnail", api.collections.getParentObjectWithThumbnail, null],
  ["children", api.collections.getChildObjects, { children: [], truncated: false }],
  ["siblings", api.collections.getSiblingObjects, []],
] as const;

describe("collection relation read authorization", () => {
  test("a read-only role can view a group managed by another role", async () => {
    const fixture = await setup();
    await fixture.t.run(async (ctx) => {
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q
            .eq("userId", fixture.noPermissionUserId)
            .eq("organizationId", fixture.owner.organizationId),
        )
        .unique();
      if (!membership) throw new Error("Missing fixture membership");
      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", {
        roleId: membership.roleId,
        permissionId,
      });
    });
    expect(
      await fixture.noPermission.query(api.collectionGroups.get, {
        groupId: fixture.groupId,
      }),
    ).toMatchObject({ _id: fixture.groupId });
  });

  test("historic foreign media and group links never expose thumbnails", async () => {
    const {
      t,
      authed,
      owner,
      other,
      parentId,
      childId,
      siblingId,
      foreignId,
      groupId,
    } = await setup();
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["private image"], { type: "image/png" }),
      );
      for (const collectionId of [parentId, childId, siblingId, foreignId]) {
        await ctx.db.insert("mediaFiles", {
          collectionId,
          organizationId: other.organizationId,
          storageId,
          fileName: "private.png",
          fileType: "image",
          fileSize: 13,
          mimeType: "image/png",
          isPrimary: true,
          uploadedBy: other.userId,
          uploadedAt: Date.now(),
          uploadStatus: "completed",
        });
      }
      for (const collectionId of [foreignId, childId]) {
        await ctx.db.insert("collectionGroupItems", {
          collectionGroupId: groupId,
          collectionId,
          addedAt: Date.now(),
          addedBy: owner.userId,
        });
      }
    });
    expect(
      await authed.query(api.collections.getParentObjectWithThumbnail, {
        collectionId: childId,
      }),
    ).toMatchObject({ thumbnailUrl: null });
    expect(
      (
        await authed.query(api.collections.getChildObjects, {
          collectionId: parentId,
        })
      ).children.every((row) => row.thumbnailUrl === null),
    ).toBe(true);
    expect(
      await authed.query(api.collections.getSiblingObjects, {
        collectionId: childId,
      }),
    ).toEqual([
      expect.objectContaining({ _id: siblingId, thumbnailUrl: null }),
    ]);
    expect(
      (await authed.query(api.collectionGroups.get, { groupId }))?.imageUrl,
    ).toBeUndefined();
  });

  test.each(
    relationOracles,
  )("%s rejects anonymous callers", async (_name, query) => {
    const fixture = await setup();
    await expect(
      fixture.t.query(query, { collectionId: fixture.childId }),
    ).rejects.toThrow("Not authenticated");
  });

  test.each(
    relationOracles,
  )("%s hides a live foreign collection behind the missing sentinel", async (_name, query, sentinel) => {
    const fixture = await setup();
    const memberMiss = await fixture.authed.query(query, {
      collectionId: fixture.missingCollectionId,
    });
    const foreignLive = await fixture.outsider.query(query, {
      collectionId: fixture.childId,
    });
    expect(memberMiss).toEqual(sentinel);
    expect(foreignLive).toEqual(memberMiss);
    await expect(
      fixture.t.query(query, { collectionId: fixture.missingCollectionId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("authorized reads preserve own relations and exclude corrupt foreign references", async () => {
    const { authed, parentId, childId, siblingId, corruptChildId } =
      await setup();
    expect(
      await authed.query(api.collections.getParentObject, {
        collectionId: childId,
      }),
    ).toMatchObject({ _id: parentId });
    expect(
      await authed.query(api.collections.getParentObjectWithThumbnail, {
        collectionId: childId,
      }),
    ).toMatchObject({ _id: parentId, thumbnailUrl: null });
    expect(
      await authed.query(api.collections.getChildObjects, {
        collectionId: parentId,
      }),
    ).toEqual({
      children: [
        expect.objectContaining({
          _id: childId,
          title: "Own object",
          accessionNumber: "CHILD",
          status: "active",
          thumbnailUrl: null,
        }),
        expect.objectContaining({
          _id: siblingId,
          title: "Own object",
          accessionNumber: "SIBLING",
          status: "active",
          thumbnailUrl: null,
        }),
      ],
      truncated: false,
    });
    expect(
      (
        await authed.query(api.collections.getSiblingObjects, {
          collectionId: childId,
        })
      ).map((row) => row._id),
    ).toEqual([siblingId]);
    expect(
      await authed.query(api.collections.getParentObject, {
        collectionId: corruptChildId,
      }),
    ).toBeNull();
    expect(
      await authed.query(api.collections.getParentObjectWithThumbnail, {
        collectionId: corruptChildId,
      }),
    ).toBeNull();
    expect(
      await authed.query(api.collections.getSiblingObjects, {
        collectionId: corruptChildId,
      }),
    ).toEqual([]);
  });

  test("group thumbnail helper picks the primary image among non-primary and non-image files", async () => {
    const { t, authed, owner, groupId, childId } = await setup();
    const primaryImageUrl = await t.run(async (ctx) => {
      await ctx.db.insert("collectionGroupItems", {
        collectionGroupId: groupId,
        collectionId: childId,
        addedAt: Date.now(),
        addedBy: owner.userId,
      });
      const nonPrimaryImageStorageId = await ctx.storage.store(
        new Blob(["alt-image"], { type: "image/png" }),
      );
      const documentStorageId = await ctx.storage.store(
        new Blob(["notes-pdf"], { type: "application/pdf" }),
      );
      const primaryImageStorageId = await ctx.storage.store(
        new Blob(["hero-image"], { type: "image/png" }),
      );
      await ctx.db.insert("mediaFiles", {
        collectionId: childId,
        organizationId: owner.organizationId,
        storageId: nonPrimaryImageStorageId,
        fileName: "alt.png",
        fileType: "image",
        fileSize: 9,
        mimeType: "image/png",
        isPrimary: false,
        uploadedBy: owner.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      await ctx.db.insert("mediaFiles", {
        collectionId: childId,
        organizationId: owner.organizationId,
        storageId: documentStorageId,
        fileName: "notes.pdf",
        fileType: "document",
        fileSize: 8,
        mimeType: "application/pdf",
        isPrimary: true,
        uploadedBy: owner.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      await ctx.db.insert("mediaFiles", {
        collectionId: childId,
        organizationId: owner.organizationId,
        storageId: primaryImageStorageId,
        fileName: "hero.png",
        fileType: "image",
        fileSize: 10,
        mimeType: "image/png",
        isPrimary: true,
        uploadedBy: owner.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      const url = await ctx.storage.getUrl(primaryImageStorageId);
      if (!url) throw new Error("missing primary image storage URL");
      return url;
    });

    expect(
      (await authed.query(api.collectionGroups.get, { groupId }))?.imageUrl,
    ).toBe(primaryImageUrl);
  });

  test("child and sibling media picks ignore non-images", async () => {
    const { t, authed, owner, parentId, childId, siblingId } = await setup();
    const childImageUrl = await t.run(async (ctx) => {
      const childDocumentStorageId = await ctx.storage.store(
        new Blob(["child-pdf"], { type: "application/pdf" }),
      );
      const childImageStorageId = await ctx.storage.store(
        new Blob(["child-img"], { type: "image/png" }),
      );
      const siblingDocumentStorageId = await ctx.storage.store(
        new Blob(["sibling-pdf"], { type: "application/pdf" }),
      );
      await ctx.db.insert("mediaFiles", {
        collectionId: childId,
        organizationId: owner.organizationId,
        storageId: childDocumentStorageId,
        fileName: "child.pdf",
        fileType: "document",
        fileSize: 9,
        mimeType: "application/pdf",
        isPrimary: true,
        uploadedBy: owner.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      await ctx.db.insert("mediaFiles", {
        collectionId: childId,
        organizationId: owner.organizationId,
        storageId: childImageStorageId,
        fileName: "child.png",
        fileType: "image",
        fileSize: 9,
        mimeType: "image/png",
        isPrimary: true,
        uploadedBy: owner.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      await ctx.db.insert("mediaFiles", {
        collectionId: siblingId,
        organizationId: owner.organizationId,
        storageId: siblingDocumentStorageId,
        fileName: "sibling.pdf",
        fileType: "document",
        fileSize: 11,
        mimeType: "application/pdf",
        isPrimary: true,
        uploadedBy: owner.userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
      const url = await ctx.storage.getUrl(childImageStorageId);
      if (!url) throw new Error("missing child image storage URL");
      return url;
    });

    expect(
      await authed.query(api.collections.getChildObjects, {
        collectionId: parentId,
      }),
    ).toEqual({
      children: [
        {
          _id: childId,
          title: "Own object",
          accessionNumber: "CHILD",
          status: "active",
          thumbnailUrl: childImageUrl,
        },
        {
          _id: siblingId,
          title: "Own object",
          accessionNumber: "SIBLING",
          status: "active",
          thumbnailUrl: null,
        },
      ],
      truncated: false,
    });
    expect(
      await authed.query(api.collections.getSiblingObjects, {
        collectionId: childId,
      }),
    ).toEqual([
      {
        _id: siblingId,
        title: "Own object",
        accessionNumber: "SIBLING",
        thumbnailUrl: null,
      },
    ]);
  });

  test("group reads require collection permission and preserve schema fields", async () => {
    const fixture = await setup();
    expect(
      await fixture.authed.query(api.collectionGroups.get, {
        groupId: fixture.groupId,
      }),
    ).toMatchObject({
      name: "Own group",
      storageLocation: "West wing",
      curatorName: "Test User",
    });
    await expect(
      fixture.t.query(api.collectionGroups.get, { groupId: fixture.groupId }),
    ).rejects.toThrow("Not authenticated");
    const memberMiss = await fixture.authed.query(api.collectionGroups.get, {
      groupId: fixture.missingGroupId,
    });
    const foreignLive = await fixture.outsider.query(api.collectionGroups.get, {
      groupId: fixture.groupId,
    });
    expect(memberMiss).toBeNull();
    expect(foreignLive).toEqual(memberMiss);
    await expect(
      fixture.t.query(api.collectionGroups.get, {
        groupId: fixture.missingGroupId,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("getChildObjects caps at 100 and sets truncated at 101", async () => {
    const { t, authed, owner } = await setup();
    const childNumbers = Array.from(
      { length: 101 },
      (_, index) => `CH-${String(index + 1).padStart(3, "0")}`,
    );
    const parentId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("collections", {
        organizationId: owner.organizationId,
        title: "Cap parent",
        accessionNumber: "CH-PARENT",
        status: "active",
        catalogedAt: Date.now(),
        catalogedBy: owner.userId,
      });
      for (const accessionNumber of childNumbers.slice(0, 100)) {
        await ctx.db.insert("collections", {
          organizationId: owner.organizationId,
          title: accessionNumber,
          accessionNumber,
          status: "active",
          catalogedAt: Date.now(),
          catalogedBy: owner.userId,
          parentObjectId: id,
        });
      }
      return id;
    });

    const atCap = await authed.query(api.collections.getChildObjects, {
      collectionId: parentId,
    });
    expect(atCap.truncated).toBe(false);
    expect(atCap.children.map((row) => row.accessionNumber)).toEqual(
      childNumbers.slice(0, 100),
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("collections", {
        organizationId: owner.organizationId,
        title: "CH-101",
        accessionNumber: "CH-101",
        status: "active",
        catalogedAt: Date.now(),
        catalogedBy: owner.userId,
        parentObjectId: parentId,
      });
    });

    const overCap = await authed.query(api.collections.getChildObjects, {
      collectionId: parentId,
    });
    expect(overCap.truncated).toBe(true);
    expect(overCap.children.map((row) => row.accessionNumber)).toEqual(
      childNumbers.slice(0, 100),
    );
  });

  test("getSiblingObjects takes 5 index rows then drops self", async () => {
    const { t, authed, owner } = await setup();
    const siblingNumbers = [
      "SB-1",
      "SB-2",
      "SB-3",
      "SB-4",
      "SB-5",
      "SB-6",
      "SB-7",
    ];
    const childIds = await t.run(async (ctx) => {
      const parentId = await ctx.db.insert("collections", {
        organizationId: owner.organizationId,
        title: "Sibling parent",
        accessionNumber: "SB-PARENT",
        status: "active",
        catalogedAt: Date.now(),
        catalogedBy: owner.userId,
      });
      return await Promise.all(
        siblingNumbers.map((accessionNumber) =>
          ctx.db.insert("collections", {
            organizationId: owner.organizationId,
            title: accessionNumber,
            accessionNumber,
            status: "active",
            catalogedAt: Date.now(),
            catalogedBy: owner.userId,
            parentObjectId: parentId,
          }),
        ),
      );
    });

    expect(
      await authed.query(api.collections.getSiblingObjects, {
        collectionId: childIds[0]!,
      }),
    ).toEqual([
      expect.objectContaining({ _id: childIds[1], accessionNumber: "SB-2" }),
      expect.objectContaining({ _id: childIds[2], accessionNumber: "SB-3" }),
      expect.objectContaining({ _id: childIds[3], accessionNumber: "SB-4" }),
      expect.objectContaining({ _id: childIds[4], accessionNumber: "SB-5" }),
    ]);
  });
});

describe("collection relation write authorization", () => {
  test("membership in both organizations does not allow cross-organization references", async () => {
    const { t, owner, other, authed, childId, foreignId, foreignLocationId } =
      await setup();
    await t.run((ctx) =>
      ctx.db.insert("userOrganizations", {
        userId: owner.userId,
        organizationId: other.organizationId,
        roleId: other.roleId,
        joinedAt: Date.now(),
      }),
    );
    for (const reference of [
      { parentObjectId: foreignId },
      { currentLocationId: foreignLocationId },
    ]) {
      await expect(
        authed.mutation(api.collections.create, {
          organizationId: owner.organizationId,
          title: "Rejected",
          ...reference,
        }),
      ).rejects.toThrow("not found in this organization");
      await expect(
        authed.mutation(api.collections.update, {
          collectionId: childId,
          ...reference,
        }),
      ).rejects.toThrow("not found in this organization");
    }
  });

  test("missing parent and location references are rejected", async () => {
    const { t, owner, authed, childId, parentId, locationId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.delete(parentId);
      await ctx.db.delete(locationId);
    });
    for (const reference of [
      { parentObjectId: parentId },
      { currentLocationId: locationId },
    ]) {
      await expect(
        authed.mutation(api.collections.create, {
          organizationId: owner.organizationId,
          title: "Rejected",
          ...reference,
        }),
      ).rejects.toThrow("not found in this organization");
      await expect(
        authed.mutation(api.collections.update, {
          collectionId: childId,
          ...reference,
        }),
      ).rejects.toThrow("not found in this organization");
    }
  });

  test("anonymous, cross-tenant and unprivileged members cannot create or update relations", async () => {
    const fixture = await setup();
    const before = await fixture.t.run((ctx) =>
      ctx.db.query("collections").collect(),
    );
    for (const caller of [fixture.t, fixture.outsider, fixture.noPermission]) {
      await expect(
        caller.mutation(api.collections.create, {
          organizationId: fixture.owner.organizationId,
          title: "Rejected",
          parentObjectId: fixture.parentId,
          currentLocationId: fixture.locationId,
        }),
      ).rejects.toThrow(/Not authenticated|Permission denied/);
      await expect(
        caller.mutation(api.collections.update, {
          collectionId: fixture.childId,
          currentLocationId: fixture.locationId,
        }),
      ).rejects.toThrow(/Not authenticated|Permission denied/);
    }
    expect(
      await fixture.t.run((ctx) => ctx.db.query("collections").collect()),
    ).toEqual(before);
  });

  test.each([
    "parent",
    "location",
  ] as const)("create and update reject foreign %s without persisting changes", async (reference) => {
    const { t, authed, owner, childId, foreignId, foreignLocationId } =
      await setup();
    const args =
      reference === "parent"
        ? { parentObjectId: foreignId }
        : { currentLocationId: foreignLocationId };
    const snapshot = () =>
      t.run(async (ctx) => ({
        collections: await ctx.db.query("collections").collect(),
        audit: await ctx.db.query("auditLog").collect(),
        counters: await ctx.db.query("organizationUsageCounters").collect(),
      }));
    const before = await snapshot();
    await expect(
      authed.mutation(api.collections.create, {
        organizationId: owner.organizationId,
        title: "Rejected",
        accessionNumber: "REJECTED",
        ...args,
      }),
    ).rejects.toThrow("not found in this organization");
    await expect(
      authed.mutation(api.collections.update, {
        collectionId: childId,
        title: "Rejected update",
        ...args,
      }),
    ).rejects.toThrow("not found in this organization");
    expect(await snapshot()).toEqual(before);
  });

  test("same-organization parent and location remain writable", async () => {
    const { t, authed, owner, parentId, childId, locationId } = await setup();
    const createdId = await authed.mutation(api.collections.create, {
      organizationId: owner.organizationId,
      title: "Allowed",
      accessionNumber: "ALLOWED",
      parentObjectId: parentId,
      currentLocationId: locationId,
    });
    await authed.mutation(api.collections.update, {
      collectionId: childId,
      parentObjectId: parentId,
      currentLocationId: locationId,
    });
    for (const id of [createdId, childId]) {
      expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
        parentObjectId: parentId,
        currentLocationId: locationId,
      });
    }
  });
});
