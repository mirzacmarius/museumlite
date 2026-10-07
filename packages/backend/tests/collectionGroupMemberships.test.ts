import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setup() {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
    "collections.delete",
  ]);
  const outsider = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
  ]);
  const user = authedForUser(t, owner.userId);
  async function group(name: string, organizationId = owner.organizationId) {
    return await t.run((ctx) =>
      ctx.db.insert("collectionGroups", {
        organizationId,
        name,
        createdAt: Date.now(),
        createdBy: owner.userId,
      }),
    );
  }
  return { t, owner, outsider, user, group };
}

test("object creation retains the designated primary group and secondary memberships", async () => {
  const f = await setup();
  const primary = await f.group("Primary");
  const secondary = await f.group("Secondary");
  const objectId = await f.user.mutation(api.collections.create, {
    organizationId: f.owner.organizationId,
    accessionNumber: "MUS-631-1",
    title: "Object",
    collectionGroupId: primary,
    collectionGroupIds: [secondary, primary],
  });

  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([
    { _id: primary, role: "primary" },
    { _id: secondary, role: "secondary" },
  ]);
});

test("changing the primary group retains secondary groups", async () => {
  const f = await setup();
  const formerPrimary = await f.group("Former primary");
  const nextPrimary = await f.group("Next primary");
  const objectId = await f.user.mutation(api.collections.create, {
    organizationId: f.owner.organizationId,
    accessionNumber: "MUS-631-2",
    title: "Object",
    collectionGroupId: formerPrimary,
    collectionGroupIds: [formerPrimary, nextPrimary],
  });

  await f.user.mutation(api.collections.update, {
    collectionId: objectId,
    collectionGroupId: nextPrimary,
  });
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([
    { _id: nextPrimary, role: "primary" },
    { _id: formerPrimary, role: "secondary" },
  ]);
});

test("cross-organization group references are rejected before membership changes", async () => {
  const f = await setup();
  const own = await f.group("Own");
  const foreign = await f.group("Foreign", f.outsider.organizationId);
  const objectId = await f.user.mutation(api.collections.create, {
    organizationId: f.owner.organizationId,
    accessionNumber: "MUS-631-3",
    title: "Object",
    collectionGroupId: own,
  });
  await expect(
    f.user.mutation(api.collections.update, {
      collectionId: objectId,
      collectionGroupId: own,
      collectionGroupIds: [own, foreign],
    }),
  ).rejects.toThrow();
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([{ _id: own, role: "primary" }]);
});

test("group actions add secondary memberships and protect the primary membership", async () => {
  const f = await setup();
  const primary = await f.group("Primary");
  const secondary = await f.group("Secondary");
  const objectId = await f.user.mutation(api.collections.create, {
    organizationId: f.owner.organizationId,
    accessionNumber: "MUS-631-4",
    title: "Object",
    collectionGroupId: primary,
  });

  await f.user.mutation(api.collectionGroups.addItems, {
    groupId: secondary,
    collectionIds: [objectId],
  });
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([
    { _id: primary, role: "primary" },
    { _id: secondary, role: "secondary" },
  ]);
  await expect(
    f.user.mutation(api.collectionGroups.removeItems, {
      groupId: primary,
      collectionIds: [objectId],
    }),
  ).rejects.toThrow(/primary/i);
  await f.user.mutation(api.collectionGroups.removeItems, {
    groupId: secondary,
    collectionIds: [objectId],
  });
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([{ _id: primary, role: "primary" }]);
});

test("legacy primary links backfill additively and repeated pages do not duplicate memberships", async () => {
  const f = await setup();
  const primary = await f.group("Primary");
  const secondary = await f.group("Secondary");
  const objectId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("collections", {
      organizationId: f.owner.organizationId,
      collectionGroupId: primary,
      accessionNumber: "MUS-631-LEGACY",
      title: "Legacy",
      status: "active",
      catalogedAt: Date.now(),
      catalogedBy: f.owner.userId,
    });
    await ctx.db.insert("collectionGroupItems", {
      collectionGroupId: secondary,
      collectionId: id,
      addedAt: Date.now(),
      addedBy: f.owner.userId,
    });
    return id;
  });
  for (let run = 0; run < 2; run++) {
    await f.t.mutation(internal.collectionGroups.backfillMemberships, {
      organizationId: f.owner.organizationId,
      cursor: null,
      limit: 20,
    });
  }
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([
    { _id: primary, role: "primary" },
    { _id: secondary, role: "secondary" },
  ]);
  expect(
    await f.user.query(api.collectionGroups.listItems, { groupId: primary }),
  ).toHaveLength(1);
});

test("ambiguous legacy roles are reported and retained for staff review", async () => {
  const f = await setup();
  const primary = await f.group("Primary");
  const conflicting = await f.group("Conflicting");
  const objectId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("collections", {
      organizationId: f.owner.organizationId,
      collectionGroupId: primary,
      accessionNumber: "MUS-631-CONFLICT",
      title: "Conflict",
      status: "active",
      catalogedAt: Date.now(),
      catalogedBy: f.owner.userId,
    });
    await ctx.db.insert("collectionGroupItems", {
      collectionGroupId: conflicting,
      collectionId: id,
      role: "primary",
      addedAt: Date.now(),
      addedBy: f.owner.userId,
    });
    return id;
  });
  const result = await f.t.mutation(
    internal.collectionGroups.backfillMemberships,
    {
      organizationId: f.owner.organizationId,
      cursor: null,
      limit: 20,
    },
  );
  expect(result.conflicts).toMatchObject([
    { collectionId: objectId, code: "conflicting_primary" },
  ]);
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ _id: conflicting, role: "primary" }),
      expect.objectContaining({ _id: primary, role: "primary" }),
    ]),
  );
});

test("group counts include legacy and canonical members and linked groups cannot be deleted", async () => {
  const f = await setup();
  const groupId = await f.group("Protected");
  await f.t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: f.owner.organizationId,
      collectionGroupId: groupId,
      accessionNumber: "MUS-631-DIRECT",
      title: "Legacy",
      status: "active",
      catalogedAt: Date.now(),
      catalogedBy: f.owner.userId,
    }),
  );
  expect(
    await f.user.query(api.collectionGroups.getStats, { groupId }),
  ).toMatchObject({ total: 1, active: 1 });
  expect(
    await f.user.query(api.collectionGroups.get, { groupId }),
  ).toMatchObject({ itemsCount: 1 });
  expect(
    await f.user.query(api.collectionGroups.listItems, { groupId }),
  ).toMatchObject([{ role: "primary" }]);
  await expect(
    f.user.mutation(api.collectionGroups.deleteGroup, { groupId }),
  ).rejects.toThrow(/member|object/i);
});

test("bulk group reassignment changes the primary role and keeps secondary membership", async () => {
  const f = await setup();
  const first = await f.group("First");
  const second = await f.group("Second");
  const objectId = await f.user.mutation(api.collections.create, {
    organizationId: f.owner.organizationId,
    accessionNumber: "MUS-631-BULK",
    title: "Bulk",
    collectionGroupId: first,
  });
  const result = await f.user.mutation(api.batchOperations.quickBulkEdit, {
    organizationId: f.owner.organizationId,
    collectionIds: [objectId],
    updates: { collectionGroupId: second },
  });
  expect(result.successCount).toBe(1);
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: objectId,
    }),
  ).toMatchObject([
    { _id: second, role: "primary" },
    { _id: first, role: "secondary" },
  ]);
});

test("CSV export and import preserve primary and secondary group roles", async () => {
  const f = await setup();
  const primary = await f.group("Primary");
  const secondary = await f.group("Secondary");
  await f.user.mutation(api.collections.create, {
    organizationId: f.owner.organizationId,
    accessionNumber: "MUS-631-EXPORT",
    title: "Source",
    collectionGroupId: primary,
    collectionGroupIds: [primary, secondary],
  });
  const rows = await f.user.mutation(api.imports.exportObjects, {
    organizationId: f.owner.organizationId,
  });
  expect(rows[0]).toMatchObject({
    collectionGroup: "Primary",
    collectionGroups: ["Primary", "Secondary"],
  });
  const csv = await f.user.mutation(api.imports.exportObjectsWithFormat, {
    organizationId: f.owner.organizationId,
    format: "csv",
  });
  expect(csv).toContain('"[""Primary"",""Secondary""]"');
  const jobId = await f.user.mutation(api.imports.createImportJob, {
    organizationId: f.owner.organizationId,
    type: "csv",
    entityType: "objects",
    totalItems: 2,
  });
  const imported = await f.user.mutation(api.imports.importObjectsBatch, {
    organizationId: f.owner.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        rowNumber: 2,
        accessionNumber: "MUS-631-IMPORTED",
        title: "Imported",
        collectionGroup: "Primary",
        collectionGroups: '["Primary","Secondary"]',
      },
      {
        rowNumber: 3,
        accessionNumber: "MUS-631-INVALID",
        title: "Invalid",
        collectionGroups: '["Secondary"]',
      },
    ],
  });
  expect(imported.results).toMatchObject([
    { status: "accepted" },
    { status: "failed" },
  ]);
  const importedId = imported.results[0]?.recordId as Id<"collections">;
  expect(
    await f.user.query(api.collectionGroups.getGroupsForCollection, {
      collectionId: importedId,
    }),
  ).toMatchObject([
    { _id: primary, role: "primary" },
    { _id: secondary, role: "secondary" },
  ]);
});
