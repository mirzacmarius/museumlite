import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

const COVERAGE_NOW = Date.UTC(2026, 8, 17, 12);
const APPRAISAL_AT = Date.UTC(2025, 8, 17, 12);
const ACCESSION_NOW = Date.UTC(2026, 5, 15, 12);

async function setup() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Private museum",
      slug: "private-museum",
      type: "museum",
      subscriptionTier: "pro",
      settings: {
        enabledModules: ["fine_art", "accounts"],
        accessionNumberFormat: "{YYYY}.{####}",
        locationTypes: ["Private storage"],
      },
    });
    const foreignOrganizationId = await ctx.db.insert("organizations", {
      name: "Other museum",
      slug: "other-museum",
      type: "museum",
      subscriptionTier: "pro",
    });
    const ownerId = await ctx.db.insert("users", {
      name: "Authorized curator",
    });
    const deniedId = await ctx.db.insert("users", {
      name: "Unprivileged member",
    });
    const outsiderId = await ctx.db.insert("users", { name: "Other curator" });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Curator",
      isSystemRole: false,
    });
    const deniedRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "No access",
      isSystemRole: false,
    });
    const foreignRoleId = await ctx.db.insert("roles", {
      organizationId: foreignOrganizationId,
      name: "Curator",
      isSystemRole: false,
    });
    for (const name of [
      "collections.read",
      "locations.read",
      "accounts.read",
      "media.upload",
      "loans.read",
      "collections.view_valuation",
    ]) {
      const insert = ctx.db.insert.bind(ctx.db);
      const permissionId = await insert("permissions", {
        name,
        category: "collections",
      });
      await insert("rolePermissions", { roleId, permissionId });
      await insert("rolePermissions", {
        roleId: foreignRoleId,
        permissionId,
      });
    }
    for (const member of [
      { userId: ownerId, roleId, organizationId },
      { userId: deniedId, roleId: deniedRoleId, organizationId },
      {
        userId: outsiderId,
        roleId: foreignRoleId,
        organizationId: foreignOrganizationId,
      },
    ]) {
      await ctx.db.insert("userOrganizations", {
        ...member,
        joinedAt: Date.now(),
      });
    }
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "PRIVATE-1",
      title: "Private object",
      status: "active",
      catalogedBy: ownerId,
      catalogedAt: Date.now(),
    });
    const missingCollectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "PRIVATE-MISSING",
      title: "Deleted object",
      status: "active",
      catalogedBy: ownerId,
      catalogedAt: Date.now(),
    });
    await ctx.db.delete(missingCollectionId);
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Private room",
      locationCode: "ROOM-1",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const missingLocationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Deleted room",
      locationCode: "ROOM-MISSING",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    await ctx.db.delete(missingLocationId);
    const foreignLocationId = await ctx.db.insert("locations", {
      organizationId: foreignOrganizationId,
      name: "Foreign room",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const accountId = await ctx.db.insert("accounts", {
      organizationId,
      accountNumber: "ACC-1",
      createdBy: ownerId,
      createdAt: Date.now(),
    });
    const missingAccountId = await ctx.db.insert("accounts", {
      organizationId,
      accountNumber: "ACC-MISSING",
      createdBy: ownerId,
      createdAt: Date.now(),
    });
    await ctx.db.delete(missingAccountId);
    const jobId = await ctx.db.insert("batchJobs", {
      organizationId,
      jobType: "bulk_edit",
      targetIds: [collectionId],
      totalItems: 1,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      createdBy: ownerId,
      createdAt: Date.now(),
    });
    const missingJobId = await ctx.db.insert("batchJobs", {
      organizationId,
      jobType: "bulk_edit",
      targetIds: [collectionId],
      totalItems: 1,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      status: "pending",
      createdBy: ownerId,
      createdAt: Date.now(),
    });
    await ctx.db.delete(missingJobId);
    const appraisalId = await ctx.db.insert("appraisals", {
      organizationId,
      collectionId,
      appraisalDate: APPRAISAL_AT,
      appraiserName: "Appraiser",
      appraisalType: "insurance",
      value: 12345,
      currency: "EUR",
      createdBy: ownerId,
      createdAt: APPRAISAL_AT,
    });
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [],
      canInitiateRoles: [roleId],
    });
    const accessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "WF-1",
      dateReceived: Date.now(),
      source: "Private donor",
      method: "gift",
      status: "pending",
    });
    const missingAccessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "WF-MISSING",
      dateReceived: Date.now(),
      source: "Deleted donor",
      method: "gift",
      status: "pending",
    });
    await ctx.db.delete(missingAccessionId);
    await ctx.db.insert("workflowHistory", {
      organizationId,
      workflowType: "accession",
      entityId: accessionId,
      fromStep: 0,
      toStep: 1,
      action: "submitted",
      performedBy: ownerId,
      performedAt: Date.now(),
      comment: "Private comment",
    });
    const storageId = await ctx.storage.store(new Blob(["test"]));
    await ctx.db.insert("mediaFiles", {
      organizationId,
      collectionId,
      storageId,
      fileName: "private.jpg",
      fileType: "image",
      mimeType: "image/jpeg",
      fileSize: 4,
      isPrimary: true,
      uploadedBy: ownerId,
      uploadedAt: Date.now(),
      uploadStatus: "processing",
      chunkedUploadId: "private-chunk",
    });
    return {
      organizationId,
      foreignOrganizationId,
      ownerId,
      deniedId,
      outsiderId,
      collectionId,
      missingCollectionId,
      locationId,
      missingLocationId,
      foreignLocationId,
      accountId,
      missingAccountId,
      jobId,
      missingJobId,
      appraisalId,
      accessionId,
      missingAccessionId,
    };
  });
  return { t, fixture };
}

type Fixture = Awaited<ReturnType<typeof setup>>["fixture"];
type Client = Pick<Awaited<ReturnType<typeof setup>>["t"], "query">;
interface ReadCase {
  name: string;
  read: (client: Client, fixture: Fixture) => Promise<unknown>;
  expected: object;
}
const reads: ReadCase[] = [
  {
    name: "workflow history",
    read: (client, f) =>
      client.query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "accession",
        entityId: f.accessionId,
      }),
    expected: [
      { comment: "Private comment", performedByName: "Authorized curator" },
    ],
  },
  {
    name: "appraisal coverage",
    read: (client, f) =>
      client.query(api.insurance.checkAppraisalForCoverage, {
        collectionId: f.collectionId,
        now: COVERAGE_NOW,
      }),
    expected: {
      hasAppraisal: true,
      appraisalValue: 12345,
      appraisalValid: true,
      appraisalAgeDays: 365,
    },
  },
  {
    name: "workflow configuration",
    read: (client, f) =>
      client.query(api.organizations.getWorkflowConfigs, {
        organizationId: f.organizationId,
      }),
    expected: [{ workflowType: "deaccession" }],
  },
  {
    name: "accession number preview",
    read: (client, f) =>
      client.query(api.organizations.getAccessionNumberPreview, {
        organizationId: f.organizationId,
        now: ACCESSION_NOW,
      }),
    expected: {
      template: "{YYYY}.{####}",
      preview: "2026.0001",
      nextNumber: "2026.0001",
      scope: "year",
    },
  },
  {
    name: "account usage",
    read: (client, f) =>
      client.query(api.accounts.checkUsage, { accountId: f.accountId }),
    expected: {
      isUsed: false,
      loanCount: 0,
      loanNumbers: [],
      truncated: false,
    },
  },
  {
    name: "batch job status",
    read: (client, f) =>
      client.query(api.batchOperations.getBatchJobStatus, { jobId: f.jobId }),
    expected: { status: "pending", createdByName: "Authorized curator" },
  },
  {
    name: "location move preview",
    read: (client, f) =>
      client.query(api.locations.checkMoveAllowed, {
        collectionId: f.collectionId,
        toLocationId: f.locationId,
      }),
    expected: { allowed: true, targetLocation: { name: "Private room" } },
  },
  {
    name: "location path",
    read: (client, f) =>
      client.query(api.locations.getLocationPath, { locationId: f.locationId }),
    expected: [{ name: "Private room" }],
  },
  {
    name: "location types",
    read: (client, f) =>
      client.query(api.locations.getLocationTypes, {
        organizationId: f.organizationId,
      }),
    expected: ["Private storage"],
  },
  {
    name: "upload progress",
    read: (client, f) =>
      client.query(api.media.getUploadProgress, {
        organizationId: f.organizationId,
        chunkId: "private-chunk",
      }),
    expected: { status: "processing", progress: 50 },
  },
];

const existenceOracleNames = new Set([
  "appraisal coverage",
  "account usage",
  "batch job status",
  "location move preview",
  "location path",
  "workflow history",
]);

for (const readCase of reads) {
  describe(readCase.name, () => {
    test("allows a member with the required permission", async () => {
      const { t, fixture } = await setup();
      const owner = t.withIdentity({ subject: fixture.ownerId });
      expect(await readCase.read(owner, fixture)).toMatchObject(
        readCase.expected,
      );
    });
    if (existenceOracleNames.has(readCase.name)) {
      test("rejects anonymous access", async () => {
        const { t, fixture } = await setup();
        await expect(readCase.read(t, fixture)).rejects.toThrow(
          "Not authenticated",
        );
      });
    } else {
      test.each([
        "anonymous",
        "denied",
        "cross-organization",
      ])("rejects %s access", async (kind) => {
        const { t, fixture } = await setup();
        const client =
          kind === "anonymous"
            ? t
            : t.withIdentity({
                subject:
                  kind === "denied" ? fixture.deniedId : fixture.outsiderId,
              });
        await expect(readCase.read(client, fixture)).rejects.toThrow(
          /Permission denied|Not authenticated/,
        );
      });
    }
  });
}

test("movement preview rejects a foreign destination even for an authorized source reader", async () => {
  const { t, fixture } = await setup();
  const unknownLocationId = await t.run(async (ctx) => {
    const locationId = await ctx.db.insert("locations", {
      organizationId: fixture.organizationId,
      name: "Deleted room",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    await ctx.db.delete(locationId);
    return locationId;
  });
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const unknownMiss = await owner.query(api.locations.checkMoveAllowed, {
    collectionId: fixture.collectionId,
    toLocationId: unknownLocationId,
  });
  const foreignMiss = await owner.query(api.locations.checkMoveAllowed, {
    collectionId: fixture.collectionId,
    toLocationId: fixture.foreignLocationId,
  });
  expect(unknownMiss).toEqual({
    allowed: false,
    requiresOverride: false,
    issues: [
      { type: "error", message: "Location not found", canOverride: false },
    ],
  });
  expect(foreignMiss).toEqual(unknownMiss);
});

test("location ancestry stops at an unauthorized foreign parent", async () => {
  const { t, fixture } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch(fixture.locationId, {
      parentLocationId: fixture.foreignLocationId,
    });
  });
  expect(
    await t
      .withIdentity({ subject: fixture.ownerId })
      .query(api.locations.getLocationPath, {
        locationId: fixture.locationId,
      }),
  ).toEqual([
    {
      _id: fixture.locationId,
      name: "Private room",
      locationCode: "ROOM-1",
      type: "storage",
    },
  ]);
});

test("appraisal coverage hides a live foreign collection behind the missing sentinel", async () => {
  const { t, fixture } = await setup();
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const outsider = t.withIdentity({ subject: fixture.outsiderId });
  const memberMiss = await owner.query(
    api.insurance.checkAppraisalForCoverage,
    {
      collectionId: fixture.missingCollectionId,
      now: COVERAGE_NOW,
    },
  );
  const foreignLive = await outsider.query(
    api.insurance.checkAppraisalForCoverage,
    {
      collectionId: fixture.collectionId,
      now: COVERAGE_NOW,
    },
  );
  expect(memberMiss).toEqual({
    hasAppraisal: false,
    appraisalValid: false,
    warning: "Collection not found",
  });
  expect(foreignLive).toEqual(memberMiss);
  await expect(
    t.query(api.insurance.checkAppraisalForCoverage, {
      collectionId: fixture.missingCollectionId,
      now: COVERAGE_NOW,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("account usage hides a live foreign account behind the missing sentinel", async () => {
  const { t, fixture } = await setup();
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const outsider = t.withIdentity({ subject: fixture.outsiderId });
  const memberMiss = await owner.query(api.accounts.checkUsage, {
    accountId: fixture.missingAccountId,
  });
  const foreignLive = await outsider.query(api.accounts.checkUsage, {
    accountId: fixture.accountId,
  });
  expect(memberMiss).toEqual({
    isUsed: false,
    loanCount: 0,
    loanNumbers: [],
    truncated: false,
  });
  expect(foreignLive).toEqual(memberMiss);
  await expect(
    t.query(api.accounts.checkUsage, { accountId: fixture.missingAccountId }),
  ).rejects.toThrow("Not authenticated");
});

test("batch job status hides a live foreign job behind the missing sentinel", async () => {
  const { t, fixture } = await setup();
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const outsider = t.withIdentity({ subject: fixture.outsiderId });
  const memberMiss = await owner.query(api.batchOperations.getBatchJobStatus, {
    jobId: fixture.missingJobId,
  });
  const foreignLive = await outsider.query(
    api.batchOperations.getBatchJobStatus,
    { jobId: fixture.jobId },
  );
  expect(memberMiss).toBeNull();
  expect(foreignLive).toEqual(memberMiss);
  await expect(
    t.query(api.batchOperations.getBatchJobStatus, {
      jobId: fixture.missingJobId,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("movement preview hides a live foreign collection behind the missing sentinel", async () => {
  const { t, fixture } = await setup();
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const outsider = t.withIdentity({ subject: fixture.outsiderId });
  const memberMiss = await owner.query(api.locations.checkMoveAllowed, {
    collectionId: fixture.missingCollectionId,
    toLocationId: fixture.locationId,
  });
  const foreignLive = await outsider.query(api.locations.checkMoveAllowed, {
    collectionId: fixture.collectionId,
    toLocationId: fixture.locationId,
  });
  expect(memberMiss).toEqual({
    allowed: false,
    requiresOverride: false,
    issues: [
      { type: "error", message: "Collection not found", canOverride: false },
    ],
  });
  expect(foreignLive).toEqual(memberMiss);
  await expect(
    t.query(api.locations.checkMoveAllowed, {
      collectionId: fixture.missingCollectionId,
      toLocationId: fixture.locationId,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("location path hides a live foreign location behind the missing sentinel", async () => {
  const { t, fixture } = await setup();
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const outsider = t.withIdentity({ subject: fixture.outsiderId });
  const memberMiss = await owner.query(api.locations.getLocationPath, {
    locationId: fixture.missingLocationId,
  });
  const foreignLive = await outsider.query(api.locations.getLocationPath, {
    locationId: fixture.locationId,
  });
  expect(memberMiss).toEqual([]);
  expect(foreignLive).toEqual(memberMiss);
  await expect(
    t.query(api.locations.getLocationPath, {
      locationId: fixture.missingLocationId,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("workflow history hides a live foreign entity behind the missing sentinel", async () => {
  const { t, fixture } = await setup();
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const outsider = t.withIdentity({ subject: fixture.outsiderId });
  const denied = t.withIdentity({ subject: fixture.deniedId });
  const memberMiss = await owner.query(
    api.workflows.getWorkflowHistoryForEntity,
    {
      workflowType: "accession",
      entityId: fixture.missingAccessionId,
    },
  );
  const foreignLive = await outsider.query(
    api.workflows.getWorkflowHistoryForEntity,
    {
      workflowType: "accession",
      entityId: fixture.accessionId,
    },
  );
  const deniedLive = await denied.query(
    api.workflows.getWorkflowHistoryForEntity,
    {
      workflowType: "accession",
      entityId: fixture.accessionId,
    },
  );
  expect(memberMiss).toEqual([]);
  expect(foreignLive).toEqual(memberMiss);
  expect(deniedLive).toEqual(memberMiss);
  await expect(
    t.query(api.workflows.getWorkflowHistoryForEntity, {
      workflowType: "accession",
      entityId: fixture.missingAccessionId,
    }),
  ).rejects.toThrow("Not authenticated");
});

test("history keeps own-org rows and drops mixed-tenant rows for the same entity", async () => {
  const { t, fixture } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowHistory", {
      organizationId: fixture.foreignOrganizationId,
      workflowType: "accession",
      entityId: fixture.accessionId,
      fromStep: 0,
      toStep: 1,
      action: "submitted",
      performedBy: fixture.outsiderId,
      performedAt: Date.now(),
      comment: "Foreign comment",
    });
  });
  expect(
    await t
      .withIdentity({ subject: fixture.ownerId })
      .query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "accession",
        entityId: fixture.accessionId,
      }),
  ).toEqual([
    expect.objectContaining({ comment: "Private comment", fromStep: 0 }),
  ]);
});

test("loan history requires loans.read even when collections.read is granted", async () => {
  const { t, fixture } = await setup();
  const loanId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("loans", {
      organizationId: fixture.organizationId,
      loanNumber: "WF-LOAN-1",
      type: "incoming",
      lenderBorrowerName: "History lender",
      startDate: Date.now(),
      status: "pending",
    });
    await ctx.db.insert("workflowHistory", {
      organizationId: fixture.organizationId,
      workflowType: "loan",
      entityId: id,
      fromStep: 0,
      toStep: 1,
      action: "submitted",
      performedBy: fixture.ownerId,
      performedAt: Date.now(),
    });
    return id;
  });
  const owner = t.withIdentity({ subject: fixture.ownerId });
  expect(
    await owner.query(api.workflows.getWorkflowHistoryForEntity, {
      workflowType: "loan",
      entityId: loanId,
    }),
  ).toEqual([
    expect.objectContaining({
      action: "submitted",
      fromStep: 0,
      toStep: 1,
    }),
  ]);
  await t.run(async (ctx) => {
    const permission = await ctx.db
      .query("permissions")
      .filter((q) => q.eq(q.field("name"), "loans.read"))
      .unique();
    if (!permission) throw new Error("Missing fixture permission");
    const rolePermissions = await ctx.db.query("rolePermissions").collect();
    for (const entry of rolePermissions) {
      if (entry.permissionId === permission._id) await ctx.db.delete(entry._id);
    }
  });
  expect(
    await owner.query(api.workflows.getWorkflowHistoryForEntity, {
      workflowType: "loan",
      entityId: loanId,
    }),
  ).toEqual([]);
});
