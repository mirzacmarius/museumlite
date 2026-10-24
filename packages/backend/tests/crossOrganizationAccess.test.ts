import { anyApi } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  type TestOrgUserOptions,
} from "./testHarness";

const STAFF_PERMISSIONS = [
  "collections.read",
  "collections.create",
  "collections.update",
  "loans.read",
  "loans.create",
  "loans.update",
  "organization.manage_settings",
  "media.upload",
  "accounts.write",
];

const FOREIGN_FILE = "File belongs to a different organization";

function organizationOptions(slugPrefix: string): TestOrgUserOptions {
  return {
    slugPrefix,
    subscriptionTier: "enterprise",
    enabledModules: ["insurance", "library", "accounts", "automotive"],
  };
}

type Organization = Awaited<
  ReturnType<typeof createOrgUserCollectionWithPermissions>
>;

/** The caller's organization and a stranger's, each with staff and one Object. */
async function twoOrganizations(t: ConvexTest) {
  const own = await createOrgUserCollectionWithPermissions(
    t,
    STAFF_PERMISSIONS,
    organizationOptions("own-museum"),
  );
  const other = await createOrgUserCollectionWithPermissions(
    t,
    STAFF_PERMISSIONS,
    organizationOptions("other-museum"),
  );
  return {
    own,
    other,
    staff: authedForUser(t, own.userId),
    outsider: authedForUser(t, other.userId),
  };
}

/** A file uploaded through the owned-upload flow by a member of `organization`. */
async function ownedUpload(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
    );
    await ctx.db.insert("storageOwnership", {
      storageId,
      uploadedBy: organization.userId,
      organizationId: organization.organizationId,
      uploadedAt: Date.now(),
    });
    return storageId;
  });
}

async function ownerOf(t: ConvexTest, storageId: Id<"_storage">) {
  return await t.run(async (ctx) => {
    const upload = await ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    return { ownerType: upload?.ownerType, ownerId: upload?.ownerId };
  });
}

async function insertTreatment(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) =>
    ctx.db.insert("conservationTreatments", {
      organizationId: organization.organizationId,
      collectionId: organization.collectionId,
      treatmentType: "cleaning",
      title: "Surface clean",
      description: "Dust removal",
      performedBy: organization.userId,
      performedAt: Date.now(),
      status: "proposed",
    }),
  );
}

async function insertPolicy(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) =>
    ctx.db.insert("insurancePolicies", {
      organizationId: organization.organizationId,
      policyNumber: `POL-${organization.organizationId.slice(-4)}`,
      carrier: "Fine Art Mutual",
      policyType: "scheduled",
      coverageAmount: 1_000_000,
      currency: "EUR",
      effectiveDate: Date.UTC(2026, 0, 1),
      expirationDate: Date.UTC(2027, 0, 1),
      status: "active",
      createdBy: organization.userId,
      createdAt: Date.now(),
    }),
  );
}

async function insertLocation(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) =>
    ctx.db.insert("locations", {
      organizationId: organization.organizationId,
      name: "Store A",
      locationCode: "S-A",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    }),
  );
}

async function insertMembershipType(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) =>
    ctx.db.insert("membershipTypes", {
      organizationId: organization.organizationId,
      name: "Standard",
      borrowingLimit: 5,
      holdLimit: 2,
      loanPeriodDays: 21,
      renewalLimit: 2,
      finePerDay: 1,
      gracePeriodDays: 0,
      isDefault: true,
      createdAt: Date.now(),
    }),
  );
}

async function insertLoanWithItem(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) => {
    const loanId = await ctx.db.insert("loans", {
      organizationId: organization.organizationId,
      loanNumber: `LOAN-${organization.organizationId.slice(-4)}`,
      type: "outgoing",
      lenderBorrowerName: "Borrower",
      startDate: Date.now(),
      status: "pending",
    });
    const loanItemId = await ctx.db.insert("loanItems", {
      loanId,
      collectionId: organization.collectionId,
    });
    return { loanId, loanItemId };
  });
}

/** A further member of `organization` whose role grants no permission. */
async function addMember(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        email: `member-${suffix}@example.com`,
        name: "Member",
      }),
      ctx.db.insert("roles", {
        organizationId: organization.organizationId,
        name: `Role ${suffix}`,
        isSystemRole: false,
      }),
    ]);
    const membershipId = await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: organization.organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return { userId, roleId, membershipId };
  });
}

async function insertInstallationTask(
  t: ConvexTest,
  organization: Organization,
  checklist: string[],
) {
  return await t.run(async (ctx) => {
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId: organization.organizationId,
      title: "Spring show",
      startDate: Date.now(),
      isCurrent: true,
    });
    const taskId = await ctx.db.insert("installationTasks", {
      organizationId: organization.organizationId,
      exhibitionId,
      title: "Hang the prints",
      taskType: "mounts",
      status: "todo",
      priority: "medium",
      createdBy: organization.userId,
      createdAt: Date.now(),
    });
    const itemIds: Id<"installationTaskChecklists">[] = [];
    for (const [index, item] of checklist.entries()) {
      itemIds.push(
        await ctx.db.insert("installationTaskChecklists", {
          taskId,
          item,
          completed: false,
          sortOrder: index,
        }),
      );
    }
    return { taskId, itemIds };
  });
}

async function insertMedia(t: ConvexTest, organization: Organization) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" }),
    );
    const mediaId = await ctx.db.insert("mediaFiles", {
      organizationId: organization.organizationId,
      collectionId: organization.collectionId,
      storageId,
      fileName: "object.jpg",
      fileType: "image",
      fileSize: 2,
      mimeType: "image/jpeg",
      mediaCategory: "image",
      isPrimary: false,
      uploadedBy: organization.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
    const versionId = await ctx.db.insert("mediaVersions", {
      originalMediaId: mediaId,
      organizationId: organization.organizationId,
      storageId,
      versionNumber: 1,
      editType: "crop",
      createdBy: organization.userId,
      createdAt: Date.now(),
    });
    return { mediaId, versionId };
  });
}

describe("public queries", () => {
  test("getBySlug answers only for an enabled portal", async () => {
    const t = createConvexTest();
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        name: "Quiet Museum",
        slug: "quiet-museum",
        type: "museum",
        settings: { portalSettings: { isEnabled: false } },
      });
      await ctx.db.insert("organizations", {
        name: "Private Collector",
        slug: "private-collector",
        type: "collector",
      });
    });

    expect(
      await t.query(api.organizations.getBySlug, { slug: "quiet-museum" }),
    ).toBeNull();
    expect(
      await t.query(api.organizations.getBySlug, {
        slug: "private-collector",
      }),
    ).toBeNull();
  });

  test("getLocationsWithEnvironment is gone", async () => {
    const t = createConvexTest();
    const { own } = await twoOrganizations(t);

    await expect(
      t.query(anyApi.locations.getLocationsWithEnvironment, {
        organizationId: own.organizationId,
      }),
    ).rejects.toThrow();
  });
});

describe("members of another organization", () => {
  test("import mappings and validation reports need membership", async () => {
    const t = createConvexTest();
    const { own, staff, outsider } = await twoOrganizations(t);
    const organizationId = own.organizationId;

    await expect(
      outsider.query(api.imports.listFieldMappings, { organizationId }),
    ).rejects.toThrow("Permission denied: collections.create");
    await expect(
      outsider.query(api.importValidation.listValidationReports, {
        organizationId,
      }),
    ).rejects.toThrow("Permission denied: collections.create");
    expect(
      await staff.query(api.imports.listFieldMappings, { organizationId }),
    ).toEqual([]);
    expect(
      await staff.query(api.importValidation.listValidationReports, {
        organizationId,
      }),
    ).toEqual([]);

    const mappingId = await t.run(async (ctx) =>
      ctx.db.insert("importFieldMappings", {
        organizationId,
        name: "Catalogue export",
        entityType: "objects",
        mappings: [{ sourceField: "Tittel", targetField: "title" }],
        createdBy: own.userId,
        createdAt: Date.now(),
      }),
    );
    expect(
      (await staff.query(api.imports.getFieldMapping, { mappingId }))?._id,
    ).toBe(mappingId);
    expect(
      await outsider.query(api.imports.getFieldMapping, { mappingId }),
    ).toBeNull();
  });

  test("my assignments need membership", async () => {
    const t = createConvexTest();
    const { own, staff, outsider } = await twoOrganizations(t);
    const organizationId = own.organizationId;

    await expect(
      outsider.query(api.assignments.listMyAssignments, { organizationId }),
    ).rejects.toThrow("Not a member of this organization");
    const assignments = await staff.query(api.assignments.listMyAssignments, {
      organizationId,
    });
    expect(assignments.stats.totalCatalogedItems).toBe(1);

    // The dashboard shows the section to every member; one whose role
    // cannot read Objects sees it empty instead of an error.
    const member = await addMember(t, own);
    expect(
      await authedForUser(t, member.userId).query(
        api.assignments.listMyAssignments,
        { organizationId },
      ),
    ).toEqual({
      recentlyModified: [],
      myCatalogedItems: [],
      stats: { totalCatalogedItems: 0, itemsModifiedThisWeek: 0 },
    });
  });

  test("a saved view needs membership", async () => {
    const t = createConvexTest();
    const { own, staff, outsider } = await twoOrganizations(t);
    const view = {
      organizationId: own.organizationId,
      name: "Mine",
      module: "objects" as const,
      filters: "{}",
    };

    await expect(
      outsider.mutation(api.savedViews.create, view),
    ).rejects.toThrow("Not a member of this organization");
    expect(await staff.mutation(api.savedViews.create, view)).toBeDefined();
  });

  test("a collection group's curator must be a member and its role one of the organization's", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const organizationId = own.organizationId;

    await expect(
      staff.mutation(api.collectionGroups.create, {
        organizationId,
        name: "Prints",
        curatorId: other.userId,
      }),
    ).rejects.toThrow("Curator is not a member of this organization");
    await expect(
      staff.mutation(api.collectionGroups.create, {
        organizationId,
        name: "Prints",
        managedByRoleId: other.roleId,
      }),
    ).rejects.toThrow("Role not found");

    const curator = await addMember(t, own);
    const groupId = await staff.mutation(api.collectionGroups.create, {
      organizationId,
      name: "Prints",
      curatorId: curator.userId,
      managedByRoleId: own.roleId,
    });
    await expect(
      staff.mutation(api.collectionGroups.update, {
        groupId,
        curatorId: other.userId,
      }),
    ).rejects.toThrow("Curator is not a member of this organization");
    await expect(
      staff.mutation(api.collectionGroups.update, {
        groupId,
        managedByRoleId: other.roleId,
      }),
    ).rejects.toThrow("Role not found");

    // The edit form resends the stored curator; one who has since left the
    // organization must not block renaming the group.
    await t.run(async (ctx) => ctx.db.delete(curator.membershipId));
    await staff.mutation(api.collectionGroups.update, {
      groupId,
      name: "Prints and drawings",
      curatorId: curator.userId,
      managedByRoleId: own.roleId,
    });
    expect((await t.run(async (ctx) => ctx.db.get(groupId)))?.name).toBe(
      "Prints and drawings",
    );
  });

  test("assessment schedules of another organization's Object stay hidden", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);

    await expect(
      staff.query(api.conservationTreatments.listAssessmentSchedules, {
        organizationId: own.organizationId,
        collectionId: other.collectionId,
      }),
    ).rejects.toThrow("Object not found");
    expect(
      await staff.query(api.conservationTreatments.listAssessmentSchedules, {
        organizationId: own.organizationId,
        collectionId: own.collectionId,
      }),
    ).toEqual([]);
  });
});

describe("files uploaded by another organization", () => {
  test("collection group images", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [foreign, mine] = await Promise.all([
      ownedUpload(t, other),
      ownedUpload(t, own),
    ]);

    await expect(
      staff.mutation(api.collectionGroups.create, {
        organizationId: own.organizationId,
        name: "Prints",
        imageId: foreign,
      }),
    ).rejects.toThrow(FOREIGN_FILE);

    const groupId = await staff.mutation(api.collectionGroups.create, {
      organizationId: own.organizationId,
      name: "Prints",
      imageId: mine,
    });
    expect(await ownerOf(t, mine)).toEqual({
      ownerType: "collectionGroup",
      ownerId: groupId,
    });
    await expect(
      staff.mutation(api.collectionGroups.update, {
        groupId,
        imageId: foreign,
      }),
    ).rejects.toThrow(FOREIGN_FILE);
  });

  test("conservation attachments", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [treatmentId, foreign, mine] = await Promise.all([
      insertTreatment(t, own),
      ownedUpload(t, other),
      ownedUpload(t, own),
    ]);
    const attachment = {
      treatmentId,
      fileName: "before.jpg",
      fileType: "image/jpeg",
      fileSize: 3,
      attachmentType: "before_photo" as const,
    };

    await expect(
      staff.mutation(api.conservationTreatments.addAttachment, {
        ...attachment,
        storageId: foreign,
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    const attachmentId = await staff.mutation(
      api.conservationTreatments.addAttachment,
      { ...attachment, storageId: mine },
    );
    expect(await ownerOf(t, mine)).toEqual({
      ownerType: "conservationAttachment",
      ownerId: attachmentId,
    });
  });

  test("installation task comments and checklist rows", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [mineTask, otherTask, foreign, mine] = await Promise.all([
      insertInstallationTask(t, own, ["Unpack", "Hang"]),
      insertInstallationTask(t, other, ["Unpack"]),
      ownedUpload(t, other),
      ownedUpload(t, own),
    ]);

    await expect(
      staff.mutation(api.installations.addComment, {
        taskId: mineTask.taskId,
        content: "Crates arrived",
        attachmentIds: [foreign],
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    const commentId = await staff.mutation(api.installations.addComment, {
      taskId: mineTask.taskId,
      content: "Crates arrived",
      attachmentIds: [mine],
    });
    expect(await ownerOf(t, mine)).toEqual({
      ownerType: "installationTaskComment",
      ownerId: commentId,
    });

    const [first, second] = mineTask.itemIds;
    if (!first || !second || !otherTask.itemIds[0]) throw new Error("seed");
    await expect(
      staff.mutation(api.installations.reorderChecklist, {
        taskId: mineTask.taskId,
        itemIds: [otherTask.itemIds[0], first],
      }),
    ).rejects.toThrow("Checklist item not found");
    await staff.mutation(api.installations.reorderChecklist, {
      taskId: mineTask.taskId,
      itemIds: [second, first],
    });
    const otherRow = await t.run((ctx) => ctx.db.get(otherTask.itemIds[0]!));
    expect(otherRow?.sortOrder).toBe(0);
    expect((await t.run((ctx) => ctx.db.get(second)))?.sortOrder).toBe(0);
  });

  test("insurance policy and claim documents", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [policyId, foreign, mine] = await Promise.all([
      insertPolicy(t, own),
      ownedUpload(t, other),
      ownedUpload(t, own),
    ]);

    await expect(
      staff.mutation(api.insurance.uploadPolicyDocument, {
        policyId,
        storageId: foreign,
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    await staff.mutation(api.insurance.uploadPolicyDocument, {
      policyId,
      storageId: mine,
    });
    expect(await ownerOf(t, mine)).toEqual({
      ownerType: "insurancePolicy",
      ownerId: policyId,
    });

    const claim = {
      organizationId: own.organizationId,
      policyId,
      incidentDate: Date.now(),
      incidentType: "water" as const,
      incidentDescription: "Ceiling leak",
      claimedAmount: 4000,
      currency: "EUR",
    };
    await expect(
      staff.mutation(api.insurance.createClaim, {
        ...claim,
        documentIds: [foreign],
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    const claimId = await staff.mutation(api.insurance.createClaim, {
      ...claim,
      collectionIds: [own.collectionId],
    });
    const [claimPhoto, disputeDocument] = await Promise.all([
      ownedUpload(t, own),
      ownedUpload(t, own),
    ]);

    await expect(
      staff.mutation(api.insurance.uploadClaimDocument, {
        claimId,
        storageId: foreign,
        documentType: "document",
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    await staff.mutation(api.insurance.uploadClaimDocument, {
      claimId,
      storageId: claimPhoto,
      documentType: "photo",
    });
    expect(await ownerOf(t, claimPhoto)).toEqual({
      ownerType: "insuranceClaim",
      ownerId: claimId,
    });

    await t.run(async (ctx) => ctx.db.patch(claimId, { isDisputed: true }));
    await expect(
      staff.mutation(api.insurance.uploadDisputeDocument, {
        claimId,
        storageId: foreign,
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    await staff.mutation(api.insurance.uploadDisputeDocument, {
      claimId,
      storageId: disputeDocument,
    });
    expect(await ownerOf(t, disputeDocument)).toEqual({
      ownerType: "insuranceClaim",
      ownerId: claimId,
    });
  });

  test("loan condition report photos", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [{ loanItemId }, foreign, mine] = await Promise.all([
      insertLoanWithItem(t, own),
      ownedUpload(t, other),
      ownedUpload(t, own),
    ]);
    const reportId = await t.run(async (ctx) =>
      ctx.db.insert("conditionReports", {
        loanItemId,
        reportType: "out",
        conditionDescription: "Good",
        assessedBy: own.userId,
        assessedAt: Date.now(),
      }),
    );

    await expect(
      staff.mutation(api.loans.updateConditionReport, {
        reportId,
        photos: [foreign],
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    await staff.mutation(api.loans.updateConditionReport, {
      reportId,
      photos: [mine],
    });
    expect(await ownerOf(t, mine)).toEqual({
      ownerType: "conditionReport",
      ownerId: reportId,
    });
  });

  test("loan condition dispute photos", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [{ loanId }, foreign, before, investigation] = await Promise.all([
      insertLoanWithItem(t, own),
      ownedUpload(t, other),
      ownedUpload(t, own),
      ownedUpload(t, own),
    ]);
    const dispute = {
      loanId,
      collectionId: own.collectionId,
      conditionBefore: "Good",
      conditionAfter: "Scratched",
      disputeDescription: "Scratch on the frame",
    };

    await expect(
      staff.mutation(api.loans.createConditionDispute, {
        ...dispute,
        conditionAfterPhotos: [foreign],
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    const disputeId = await staff.mutation(api.loans.createConditionDispute, {
      ...dispute,
      conditionBeforePhotos: [before],
    });
    expect(await ownerOf(t, before)).toEqual({
      ownerType: "conditionDispute",
      ownerId: disputeId,
    });

    await t.run(async (ctx) =>
      ctx.db.patch(disputeId, { status: "investigating" }),
    );
    await expect(
      staff.mutation(api.loans.updateDisputeInvestigation, {
        disputeId,
        investigationPhotos: [foreign],
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    await staff.mutation(api.loans.updateDisputeInvestigation, {
      disputeId,
      investigationPhotos: [investigation],
    });
    expect(await ownerOf(t, investigation)).toEqual({
      ownerType: "conditionDispute",
      ownerId: disputeId,
    });
  });

  test("transit status photos and linked records", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [foreign, mine, otherLocation, otherPolicy] = await Promise.all([
      ownedUpload(t, other),
      ownedUpload(t, own),
      insertLocation(t, other),
      insertPolicy(t, other),
    ]);
    const record = {
      organizationId: own.organizationId,
      transitType: "outgoing" as const,
      originName: "Museum Storage",
      destinationName: "Partner Gallery",
      carrier: "Art Handler Co",
    };

    await expect(
      staff.mutation(api.transit.createTransitRecord, {
        ...record,
        originLocationId: otherLocation,
      }),
    ).rejects.toThrow("Origin location not found");
    await expect(
      staff.mutation(api.transit.createTransitRecord, {
        ...record,
        insurancePolicyId: otherPolicy,
      }),
    ).rejects.toThrow("Insurance policy not found");

    const transitRecordId = await staff.mutation(
      api.transit.createTransitRecord,
      record,
    );
    await expect(
      staff.mutation(api.transit.updateTransitRecord, {
        transitRecordId,
        destinationLocationId: otherLocation,
      }),
    ).rejects.toThrow("Destination location not found");
    await expect(
      staff.mutation(api.transit.updateTransitStatus, {
        transitRecordId,
        status: "in_transit",
        description: "Picked up",
        photoIds: [foreign],
      }),
    ).rejects.toThrow(FOREIGN_FILE);
    const statusUpdateId = await staff.mutation(
      api.transit.updateTransitStatus,
      {
        transitRecordId,
        status: "in_transit",
        description: "Picked up",
        photoIds: [mine],
      },
    );
    expect(await ownerOf(t, mine)).toEqual({
      ownerType: "transitStatusUpdate",
      ownerId: statusUpdateId,
    });
  });
});

describe("identifiers from another organization in writes", () => {
  test("alert rule recipients", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const rule = {
      organizationId: own.organizationId,
      name: "Overdue assessments",
      triggerType: "assessment_due" as const,
      priority: "medium" as const,
      emailNotification: false,
      inAppNotification: true,
    };

    await expect(
      staff.mutation(api.conservationTreatments.createAlertRule, {
        ...rule,
        notifyRoles: [other.roleId],
      }),
    ).rejects.toThrow("Role not found");
    await expect(
      staff.mutation(api.conservationTreatments.createAlertRule, {
        ...rule,
        notifyUsers: [other.userId],
      }),
    ).rejects.toThrow("Recipient is not a member of this organization");
    const ruleId = await staff.mutation(
      api.conservationTreatments.createAlertRule,
      { ...rule, notifyRoles: [own.roleId], notifyUsers: [own.userId] },
    );
    await expect(
      staff.mutation(api.conservationTreatments.updateAlertRule, {
        ruleId,
        notifyUsers: [other.userId],
      }),
    ).rejects.toThrow("Recipient is not a member of this organization");
  });

  test("a scheduled assessment completed with another organization's treatment", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [scheduleId, otherTreatment, ownTreatment] = await Promise.all([
      t.run((ctx) =>
        ctx.db.insert("assessmentSchedules", {
          organizationId: own.organizationId,
          name: "Annual check",
          intervalDays: 365,
          assessmentType: "condition",
          isActive: true,
          createdBy: own.userId,
          createdAt: Date.now(),
        }),
      ),
      insertTreatment(t, other),
      insertTreatment(t, own),
    ]);

    await expect(
      staff.mutation(api.conservationTreatments.completeScheduledAssessment, {
        scheduleId,
        treatmentId: otherTreatment,
      }),
    ).rejects.toThrow("Treatment not found");
    await staff.mutation(
      api.conservationTreatments.completeScheduledAssessment,
      { scheduleId, treatmentId: ownTreatment },
    );
    const schedule = await t.run((ctx) => ctx.db.get(scheduleId));
    expect(schedule?.lastTreatmentId).toBe(ownTreatment);
  });

  test("media edit versions", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [mine, theirs] = await Promise.all([
      insertMedia(t, own),
      insertMedia(t, other),
    ]);

    await expect(
      staff.mutation(api.mediaEdits.trackEdit, {
        mediaId: mine.mediaId,
        versionId: theirs.versionId,
        operation: "crop",
      }),
    ).rejects.toThrow("Version not found");
    expect(
      await staff.mutation(api.mediaEdits.trackEdit, {
        mediaId: mine.mediaId,
        versionId: mine.versionId,
        operation: "crop",
      }),
    ).toBeDefined();
  });

  test("account roles, membership type and branch", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const [otherMembershipType, otherBranch] = await Promise.all([
      insertMembershipType(t, other),
      insertLocation(t, other),
    ]);
    const account = {
      organizationId: own.organizationId,
      accountType: "lender" as const,
      businessName: "Lender Inc",
    };

    await expect(
      staff.mutation(api.accounts.create, {
        ...account,
        roleIds: [other.roleId],
      }),
    ).rejects.toThrow("Role not found");
    await expect(
      staff.mutation(api.accounts.create, {
        ...account,
        membershipTypeId: otherMembershipType,
      }),
    ).rejects.toThrow("Membership type not found");
    await expect(
      staff.mutation(api.accounts.create, {
        ...account,
        preferredBranch: otherBranch,
      }),
    ).rejects.toThrow("Branch not found");

    const accountId = await staff.mutation(api.accounts.create, {
      ...account,
      roleIds: [own.roleId],
    });
    await expect(
      staff.mutation(api.accounts.update, {
        accountId,
        roleIds: [other.roleId],
      }),
    ).rejects.toThrow("Role not found");
    await expect(
      staff.mutation(api.accounts.update, {
        accountId,
        membershipTypeId: otherMembershipType,
      }),
    ).rejects.toThrow("Membership type not found");
    await expect(
      staff.mutation(api.accounts.update, {
        accountId,
        preferredBranch: otherBranch,
      }),
    ).rejects.toThrow("Branch not found");
  });

  test("library items linked to an Object", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const item = {
      organizationId: own.organizationId,
      title: "Catalogue raisonné",
      itemType: "book" as const,
      authors: ["Editor"],
      language: "en",
    };

    await expect(
      staff.mutation(api.library.items.create, {
        ...item,
        collectionId: other.collectionId,
      }),
    ).rejects.toThrow("Object not found");
    const itemId = await staff.mutation(api.library.items.create, {
      ...item,
      collectionId: own.collectionId,
    });
    await expect(
      staff.mutation(api.library.items.update, {
        itemId,
        collectionId: other.collectionId,
      }),
    ).rejects.toThrow("Object not found");
  });

  test("workflow templates belong to the organization that saved them", async () => {
    const t = createConvexTest();
    const { own, other, staff } = await twoOrganizations(t);
    const steps = [{ stepNumber: 1, name: "Review", roleName: "Test Role" }];
    const [systemTemplate, theirs, mine] = await t.run(async (ctx) => [
      await ctx.db.insert("workflowTemplates", {
        name: "Standard accession",
        workflowType: "accession",
        isSystem: true,
        steps,
        createdAt: Date.now(),
      }),
      await ctx.db.insert("workflowTemplates", {
        organizationId: other.organizationId,
        name: "Their accession",
        workflowType: "accession",
        isSystem: false,
        steps,
        createdAt: Date.now(),
      }),
      await ctx.db.insert("workflowTemplates", {
        organizationId: own.organizationId,
        name: "Our accession",
        workflowType: "accession",
        isSystem: false,
        steps,
        createdAt: Date.now(),
      }),
    ]);
    const organizationId = own.organizationId;

    const listed = await staff.query(api.workflows.listTemplates, {
      organizationId,
    });
    expect(listed.map((template) => template._id).sort()).toEqual(
      [systemTemplate, mine].sort(),
    );
    expect(
      await staff.query(api.workflows.getTemplate, {
        organizationId,
        templateId: theirs,
      }),
    ).toBeNull();
    expect(
      await staff.query(api.workflows.getTemplate, {
        organizationId,
        templateId: mine,
      }),
    ).not.toBeNull();
    await expect(
      staff.mutation(api.workflows.applyTemplateToOrganization, {
        organizationId,
        templateId: theirs,
      }),
    ).rejects.toThrow("Template not found");
  });

  test("a VIN lookup stays inside the organization", async () => {
    const t = createConvexTest();
    const { own, other, staff, outsider } = await twoOrganizations(t);
    const vin = "WVWZZZ1JZXW000001";
    await t.run(async (ctx) => {
      for (const organization of [own, other]) {
        await ctx.db.insert("vehicleDetails", {
          organizationId: organization.organizationId,
          collectionId: organization.collectionId,
          createdAt: Date.now(),
          vin,
          make: "Volkswagen",
        });
      }
    });

    const details = await staff.query(api.vehicleDetails.getByVin, {
      organizationId: own.organizationId,
      vin,
    });
    expect(details?.collectionId).toBe(own.collectionId);
    await expect(
      outsider.query(api.vehicleDetails.getByVin, {
        organizationId: own.organizationId,
        vin,
      }),
    ).rejects.toThrow("Permission denied: collections.read");
  });
});
