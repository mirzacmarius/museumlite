import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

type ConvexTest = ReturnType<typeof createConvexTest>;

async function setup(
  permissions: string[],
  enabledModules?: Parameters<
    typeof createOrgUserWithPermissions
  >[2]["enabledModules"],
) {
  const t = createConvexTest();
  const own = await createOrgUserWithPermissions(t, permissions, {
    subscriptionTier: "pro",
    enabledModules,
  });
  return { t, own, user: authedForUser(t, own.userId) };
}

async function createJob(
  user: ReturnType<typeof authedForUser>,
  organizationId: Id<"organizations">,
  entityType: "objects" | "locations" | "accounts" | "loans",
  totalItems: number,
) {
  return await user.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    entityType,
    totalItems,
  });
}

async function insertLocation(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
) {
  return await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name,
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );
}

test("object replay creates one object with accountable placement, group membership and usage", async () => {
  const { t, own, user } = await setup([
    "collections.create",
    "collections.read",
  ]);
  const storeId = await insertLocation(t, own.organizationId, "Store A");
  const groupId = await t.run((ctx) =>
    ctx.db.insert("collectionGroups", {
      organizationId: own.organizationId,
      name: "Ceramics",
      createdBy: own.userId,
      createdAt: Date.now(),
    }),
  );
  const jobId = await createJob(user, own.organizationId, "objects", 1);
  const request = {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        rowNumber: 2,
        accessionNumber: "OBJ-1",
        title: "Bowl",
        location: "store a",
        collectionGroup: "Ceramics",
      },
    ],
  };
  const first = await user.mutation(api.imports.importObjectsBatch, request);
  const replay = await user.mutation(api.imports.importObjectsBatch, request);
  expect(first.results[0]).toMatchObject({ status: "accepted" });
  expect(replay.results[0]).toMatchObject({
    status: "accepted",
    replayed: true,
    recordId: first.results[0]?.recordId,
  });

  const collectionId = first.results[0]?.recordId as Id<"collections">;
  const objects = await t.run((ctx) =>
    ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", own.organizationId),
      )
      .collect(),
  );
  expect(objects).toHaveLength(1);
  expect(objects[0]?.currentLocationId).toBe(storeId);
  expect(
    await user.query(api.locations.getCollectionLocationHistory, {
      collectionId,
    }),
  ).toMatchObject([
    {
      toLocationId: storeId,
      movedBy: own.userId,
      reason: expect.stringContaining("import"),
    },
  ]);
  const membership = await t.run((ctx) =>
    ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect(),
  );
  expect(membership.map((item) => item.collectionGroupId)).toEqual([groupId]);
  const usage = await t.run((ctx) =>
    ctx.db
      .query("organizationUsageCounters")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", own.organizationId),
      )
      .unique(),
  );
  expect(usage?.objectCount).toBe(1);
});

test("object rows with ambiguous or inactive locations fail instead of guessing", async () => {
  const { t, own, user } = await setup(["collections.create"]);
  await insertLocation(t, own.organizationId, "Twin");
  await insertLocation(t, own.organizationId, "twin");
  const closedId = await insertLocation(t, own.organizationId, "Closed");
  await t.run((ctx) => ctx.db.patch(closedId, { isActive: false }));
  const jobId = await createJob(user, own.organizationId, "objects", 2);
  const result = await user.mutation(api.imports.importObjectsBatch, {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      { rowNumber: 2, title: "A", location: "Twin" },
      { rowNumber: 3, title: "B", location: "Closed" },
    ],
  });
  expect(result.results).toMatchObject([
    {
      status: "failed",
      errors: [expect.stringContaining("more than one location")],
    },
    { status: "failed", errors: [expect.stringContaining("unavailable")] },
  ]);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", own.organizationId),
        )
        .collect(),
    ),
  ).toEqual([]);
});

test("location replay resolves parents from earlier rows and rejects invalid capacity", async () => {
  const { t, own, user } = await setup([
    "locations.create",
    "organization.manage_settings",
  ]);
  const jobId = await createJob(user, own.organizationId, "locations", 3);
  const request = {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      { rowNumber: 2, name: "Building", locationCode: "B1", type: "building" },
      {
        rowNumber: 3,
        name: "Room",
        locationCode: "R1",
        type: "room",
        parentLocation: "Building",
        capacity: "12",
      },
      {
        rowNumber: 4,
        name: "Shelf",
        locationCode: "S1",
        type: "shelf",
        capacity: "about ten",
      },
    ],
  };
  const first = await user.mutation(api.imports.importLocationsBatch, request);
  await user.mutation(api.imports.importLocationsBatch, request);
  expect(first.results.map((row) => row.status)).toEqual([
    "accepted",
    "accepted",
    "failed",
  ]);
  expect(first.results[2]?.errors[0]).toContain("Capacity");
  const locations = await t.run((ctx) =>
    ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", own.organizationId),
      )
      .collect(),
  );
  expect(locations.map((location) => location.name).sort()).toEqual([
    "Building",
    "Room",
  ]);
  const room = locations.find((location) => location.name === "Room");
  expect(room?.parentLocationId).toBe(first.results[0]?.recordId);
  expect(room?.capacity).toBe(12);
});

test("account imports use the account permission, register numbering and uniqueness", async () => {
  const denied = await setup(
    ["organization.manage_settings", "loans.create"],
    ["accounts"],
  );
  await expect(
    createJob(denied.user, denied.own.organizationId, "accounts", 1),
  ).rejects.toThrow("accounts.write");

  const { t, own, user } = await setup(
    ["accounts.write", "accounts.read", "organization.manage_settings"],
    ["accounts"],
  );
  const jobId = await createJob(user, own.organizationId, "accounts", 3);
  const result = await user.mutation(api.imports.importAccountsBatch, {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      { rowNumber: 2, accountType: "lender", businessName: "Gallery" },
      {
        rowNumber: 3,
        accountNumber: "LEGACY-7",
        accountType: "borrower",
        businessName: "Museum",
      },
      {
        rowNumber: 4,
        accountNumber: "LEGACY-7",
        accountType: "borrower",
        businessName: "Copy",
      },
    ],
  });
  expect(result.results.map((row) => row.status)).toEqual([
    "accepted",
    "accepted",
    "failed",
  ]);
  expect(result.results[0]?.identifier).toMatch(/^ACC-\d{5}$/);
  expect(result.results[1]?.identifier).toBe("LEGACY-7");
  expect(result.results[2]?.errors[0]).toContain("already");
  const accounts = await t.run((ctx) =>
    ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", own.organizationId),
      )
      .collect(),
  );
  expect(accounts).toHaveLength(2);
});

test("loan imports reject unknown dates and duplicate numbers instead of guessing", async () => {
  const { t, own, user } = await setup(["loans.create"]);
  const jobId = await createJob(user, own.organizationId, "loans", 4);
  const base = {
    type: "incoming",
    lenderBorrowerName: "Lender",
  };
  const result = await user.mutation(api.imports.importLoansBatch, {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      { ...base, rowNumber: 2, startDate: "2024-05-01", endDate: "2024-06-01" },
      { ...base, rowNumber: 3, startDate: "sometime in spring" },
      { ...base, rowNumber: 4, startDate: "2024-05-01", endDate: "2024-04-01" },
      {
        ...base,
        rowNumber: 5,
        loanNumber: "LN-OLD-1",
        startDate: "2024-05-01",
        insuranceValue: "lots",
      },
    ],
  });
  expect(result.results.map((row) => row.status)).toEqual([
    "accepted",
    "failed",
    "failed",
    "failed",
  ]);
  expect(result.results[0]?.identifier).toMatch(/^L\d{4}\.\d{2}\.\d{4}$/);
  expect(result.results[1]?.errors[0]).toContain("Start date");
  expect(result.results[2]?.errors[0]).toContain("End date");
  expect(result.results[3]?.errors[0]).toContain("Insurance value");

  const second = await user.mutation(api.imports.importLoansBatch, {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        ...base,
        rowNumber: 5,
        loanNumber: result.results[0]?.identifier,
        startDate: "2024-05-01",
      },
    ],
  });
  expect(second.results[0]?.errors[0]).toContain("already in use");
  const loans = await t.run((ctx) =>
    ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", own.organizationId),
      )
      .collect(),
  );
  expect(loans).toHaveLength(1);
  expect(loans[0]?.startDate).toBe(Date.UTC(2024, 4, 1));
});

test("Dublin Core replays on the same job do not duplicate objects", async () => {
  const { t, own, user } = await setup(["collections.create"]);
  const jobId = await user.mutation(api.imports.createImportJob, {
    organizationId: own.organizationId,
    type: "csv",
    entityType: "objects",
    totalItems: 1,
  });
  const xml = `<?xml version="1.0"?>
<records>
  <oai_dc:dc><dc:title>First</dc:title><dc:identifier>DC-1</dc:identifier></oai_dc:dc>
  <oai_dc:dc><dc:title>Second</dc:title><dc:identifier>DC-2</dc:identifier></oai_dc:dc>
</records>`;
  const first = await user.mutation(api.imports.importObjectsDublinCore, {
    organizationId: own.organizationId,
    jobId,
    xml,
  });
  const replay = await user.mutation(api.imports.importObjectsDublinCore, {
    organizationId: own.organizationId,
    jobId,
    xml,
  });
  expect(first.processed).toBe(2);
  expect(replay.processed).toBe(0);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", own.organizationId),
        )
        .collect(),
    ),
  ).toHaveLength(2);
  expect(await user.query(api.imports.getImportJob, { jobId })).toMatchObject({
    totalItems: 2,
    attemptedItems: 2,
    acceptedItems: 2,
    status: "completed",
  });
});

test("finished jobs refuse rows that were not part of the original file, and cancelled jobs refuse all rows", async () => {
  const { own, user } = await setup([
    "locations.create",
    "organization.manage_settings",
  ]);
  const jobId = await createJob(user, own.organizationId, "locations", 1);
  const row = { name: "Hall", locationCode: "H1", type: "room" };
  await user.mutation(api.imports.importLocationsBatch, {
    organizationId: own.organizationId,
    jobId,
    batchIndex: 0,
    rows: [{ ...row, rowNumber: 2 }],
  });
  await expect(
    user.mutation(api.imports.importLocationsBatch, {
      organizationId: own.organizationId,
      jobId,
      batchIndex: 0,
      rows: [{ ...row, rowNumber: 9, locationCode: "H9" }],
    }),
  ).rejects.toThrow("not part of this import");

  const cancelledJob = await createJob(
    user,
    own.organizationId,
    "locations",
    1,
  );
  await user.mutation(api.imports.cancelImportJob, { jobId: cancelledJob });
  await expect(
    user.mutation(api.imports.importLocationsBatch, {
      organizationId: own.organizationId,
      jobId: cancelledJob,
      batchIndex: 0,
      rows: [{ ...row, rowNumber: 2 }],
    }),
  ).rejects.toThrow("cancelled");
});
