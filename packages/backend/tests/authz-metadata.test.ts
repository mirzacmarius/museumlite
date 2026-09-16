import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

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
    ]) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
      await ctx.db.insert("rolePermissions", {
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
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Private room",
      locationCode: "ROOM-1",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
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
    const appraisalId = await ctx.db.insert("appraisals", {
      organizationId,
      collectionId,
      appraisalDate: Date.now(),
      appraiserName: "Appraiser",
      appraisalType: "insurance",
      value: 12345,
      currency: "EUR",
      createdBy: ownerId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [],
      canInitiateRoles: [roleId],
    });
    await ctx.db.insert("workflowHistory", {
      organizationId,
      workflowType: "accession",
      entityId: collectionId,
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
      locationId,
      foreignLocationId,
      accountId,
      jobId,
      appraisalId,
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
        entityId: f.collectionId,
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
      }),
    expected: { hasAppraisal: true, appraisalValue: 12345 },
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
      }),
    expected: { template: "{YYYY}.{####}" },
  },
  {
    name: "account usage",
    read: (client, f) =>
      client.query(api.accounts.checkUsage, { accountId: f.accountId }),
    expected: { isUsed: false, loanCount: 0, loanNumbers: [] },
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
    read: (client) =>
      client.query(api.media.getUploadProgress, { chunkId: "private-chunk" }),
    expected: { status: "processing", progress: 50 },
  },
];

for (const readCase of reads) {
  describe(readCase.name, () => {
    test("allows a member with the required permission", async () => {
      const { t, fixture } = await setup();
      const owner = t.withIdentity({ subject: fixture.ownerId });
      expect(await readCase.read(owner, fixture)).toMatchObject(
        readCase.expected,
      );
    });
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
  });
}

test("movement preview rejects a foreign destination even for an authorized source reader", async () => {
  const { t, fixture } = await setup();
  await expect(
    t
      .withIdentity({ subject: fixture.ownerId })
      .query(api.locations.checkMoveAllowed, {
        collectionId: fixture.collectionId,
        toLocationId: fixture.foreignLocationId,
      }),
  ).rejects.toThrow("Location does not belong to the collection organization");
});

test("location ancestry cannot disclose an unauthorized foreign parent", async () => {
  const { t, fixture } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch(fixture.locationId, {
      parentLocationId: fixture.foreignLocationId,
    });
  });
  await expect(
    t
      .withIdentity({ subject: fixture.ownerId })
      .query(api.locations.getLocationPath, {
        locationId: fixture.locationId,
      }),
  ).rejects.toThrow("Permission denied");
});

test("history checks every organization before returning mixed-tenant records", async () => {
  const { t, fixture } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowHistory", {
      organizationId: fixture.foreignOrganizationId,
      workflowType: "accession",
      entityId: fixture.collectionId,
      fromStep: 0,
      toStep: 1,
      action: "submitted",
      performedBy: fixture.outsiderId,
      performedAt: Date.now(),
      comment: "Foreign comment",
    });
  });
  await expect(
    t
      .withIdentity({ subject: fixture.ownerId })
      .query(api.workflows.getWorkflowHistoryForEntity, {
        workflowType: "accession",
        entityId: fixture.collectionId,
      }),
  ).rejects.toThrow("Permission denied");
});

test("loan history requires loans.read even when collections.read is granted", async () => {
  const { t, fixture } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowHistory", {
      organizationId: fixture.organizationId,
      workflowType: "loan",
      entityId: "loan-history",
      fromStep: 0,
      toStep: 1,
      action: "submitted",
      performedBy: fixture.ownerId,
      performedAt: Date.now(),
    });
  });
  const owner = t.withIdentity({ subject: fixture.ownerId });
  expect(
    await owner.query(api.workflows.getWorkflowHistoryForEntity, {
      workflowType: "loan",
      entityId: "loan-history",
    }),
  ).toHaveLength(1);
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
  await expect(
    owner.query(api.workflows.getWorkflowHistoryForEntity, {
      workflowType: "loan",
      entityId: "loan-history",
    }),
  ).rejects.toThrow("Permission denied: loans.read");
});
