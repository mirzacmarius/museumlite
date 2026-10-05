import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

test("treatment deletion refuses destruction and keeps the original treatment retrievable", async () => {
  const t = createConvexTest();
  const { collectionId, userId } = await createOrgUserCollectionWithPermissions(
    t,
    ["collections.read", "collections.update", "collections.delete"],
    { subscriptionTier: "pro" },
  );
  const staff = authedForUser(t, userId);
  const id = await staff.mutation(api.conservationTreatments.create, {
    collectionId,
    treatmentType: "assessment",
    title: "Historic assessment",
    description: "Condition evidence",
  });
  await expect(
    staff.mutation(api.conservationTreatments.remove, { id }),
  ).rejects.toThrow("Permanent evidence");
  const treatment = await staff.query(api.conservationTreatments.get, { id });
  expect(treatment?._id).toBe(id);
  expect(treatment?.description).toBe("Condition evidence");
});

test("rejected register cleanup refuses destruction and retains the rejected accession", async () => {
  const t = createConvexTest();
  const { organizationId, userId } =
    await createOrgUserCollectionWithPermissions(t, [
      "collections.read",
      "collections.delete",
    ]);
  const accessionId = await t.run(async (ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "REJECTED-42",
      dateReceived: 100,
      source: "Original intake",
      method: "gift",
      status: "rejected",
    }),
  );
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.accessions.emptyRejected, { organizationId }),
  ).rejects.toThrow("Permanent evidence");
  const register = await staff.query(api.accessions.get, { accessionId });
  expect(register?._id).toBe(accessionId);
  expect(register?.source).toBe("Original intake");
  expect(register?.status).toBe("rejected");
});

test("original media deletion refuses destruction and preserves its download", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(t, [
      "collections.read",
      "media.read",
      "media.delete",
    ]);
  const mediaId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["Original document"], { type: "application/pdf" }),
    );
    return ctx.db.insert("mediaFiles", {
      organizationId,
      collectionId,
      storageId,
      fileName: "original.pdf",
      fileType: "document",
      fileSize: 17,
      mimeType: "application/pdf",
      isPrimary: false,
      uploadedBy: userId,
      uploadedAt: 123,
      uploadStatus: "completed",
    });
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.media.deleteMedia, { mediaId }),
  ).rejects.toThrow("Permanent evidence");
  const media = await staff.query(api.media.list, { collectionId });
  expect(media.map((file) => file._id)).toEqual([mediaId]);
  expect(media[0]?.url).toBeTruthy();
});

test("valuation deletion refuses destruction and retains valuation evidence", async () => {
  const t = createConvexTest();
  const { collectionId, userId } = await createOrgUserCollectionWithPermissions(
    t,
    ["collections.read", "collections.update", "collections.delete"],
  );
  const staff = authedForUser(t, userId);
  const appraisalId = await staff.mutation(api.appraisals.create, {
    collectionId,
    appraisalDate: 100,
    appraiserName: "Original appraiser",
    appraisalType: "market",
    value: 4200,
    currency: "EUR",
  });
  await expect(
    staff.mutation(api.appraisals.remove, { appraisalId }),
  ).rejects.toThrow("Permanent evidence");
  expect((await staff.query(api.appraisals.get, { appraisalId }))?.value).toBe(
    4200,
  );
});

test("treatment attachment removal preserves the original downloadable evidence", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["collections.read", "collections.update"],
      { subscriptionTier: "pro" },
    );
  const staff = authedForUser(t, userId);
  const treatmentId = await staff.mutation(api.conservationTreatments.create, {
    collectionId,
    treatmentType: "assessment",
    title: "Assessment",
    description: "Evidence",
  });
  const attachmentId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["Photograph"]));
    return ctx.db.insert("conservationAttachments", {
      organizationId,
      treatmentId,
      storageId,
      fileName: "before.jpg",
      fileType: "image/jpeg",
      fileSize: 10,
      attachmentType: "before_photo",
      uploadedBy: userId,
      uploadedAt: 100,
    });
  });
  await expect(
    staff.mutation(api.conservationTreatments.removeAttachment, {
      attachmentId,
    }),
  ).rejects.toThrow("Permanent evidence");
  const attachments = await staff.query(
    api.conservationTreatments.listAttachments,
    { treatmentId },
  );
  expect(attachments.map((file) => file._id)).toEqual([attachmentId]);
  expect(attachments[0]?.url).toBeTruthy();
});

test("loan document deletion preserves the original document and its case relationship", async () => {
  const t = createConvexTest();
  const { organizationId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["loans.read", "loans.update"],
      { subscriptionTier: "pro" },
    );
  const { loanId, documentId } = await t.run(async (ctx) => {
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-42",
      type: "outgoing",
      lenderBorrowerName: "Borrower",
      startDate: 100,
      status: "cancelled",
    });
    const storageId = await ctx.storage.store(new Blob(["Signed agreement"]));
    const documentId = await ctx.db.insert("loanDocuments", {
      loanId,
      storageId,
      documentType: "agreement",
      fileName: "signed.pdf",
      uploadedBy: userId,
      uploadedAt: 100,
    });
    return { loanId, documentId };
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.loans.deleteLoanDocument, { documentId }),
  ).rejects.toThrow("Permanent evidence");
  const documents = await staff.query(api.loans.listLoanDocuments, { loanId });
  expect(documents.map((file) => file._id)).toEqual([documentId]);
  expect(documents[0]?.url).toBeTruthy();
});

test("unmapped legacy upload stays reviewable after refused orphan cleanup", async () => {
  const t = createConvexTest();
  const { organizationId, userId } =
    await createOrgUserCollectionWithPermissions(t, [
      "media.read",
      "media.delete",
      "media.upload",
    ]);
  const { jobId, storageId } = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["Unclassified original"]),
    );
    const jobId = await ctx.db.insert("importJobs", {
      organizationId,
      type: "media",
      status: "pending",
      progress: 0,
      totalItems: 1,
      processedItems: 0,
      createdBy: userId,
      createdAt: 100,
    });
    await ctx.db.insert("mediaImportJobData", {
      jobId,
      mappingType: "csv",
      mappingData: [],
      uploadedFiles: [
        {
          storageId,
          fileName: "legacy.pdf",
          fileSize: 21,
          mimeType: "application/pdf",
          mapped: false,
        },
      ],
    });
    return { jobId, storageId };
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.mediaImports.deleteUnmappedFile, { jobId, storageId }),
  ).rejects.toThrow("Permanent evidence");
  const files = await staff.query(api.mediaImports.getUnmappedFiles, { jobId });
  expect(files.map((file) => file.storageId)).toEqual([storageId]);
});

test("bulk loan cleanup cannot erase retained condition evidence", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["loans.read", "loans.update", "collections.read"],
      { subscriptionTier: "pro" },
    );
  const { loanId, conditionReportId } = await t.run(async (ctx) => {
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LOAN-43",
      type: "outgoing",
      lenderBorrowerName: "Borrower",
      startDate: 100,
      status: "cancelled",
    });
    const loanItemId = await ctx.db.insert("loanItems", {
      loanId,
      collectionId,
    });
    const conditionReportId = await ctx.db.insert("conditionReports", {
      loanItemId,
      reportType: "out",
      conditionDescription: "Original outgoing condition",
      assessedBy: userId,
      assessedAt: 100,
    });
    await ctx.db.patch(loanItemId, { conditionReportId });
    return { loanId, conditionReportId };
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.loans.deleteAllLoans, { organizationId }),
  ).rejects.toThrow("Permanent evidence");
  expect((await staff.query(api.loans.get, { loanId }))?._id).toBe(loanId);
  expect(
    (
      await staff.query(api.loans.getConditionReport, {
        reportId: conditionReportId,
      })
    )?.conditionDescription,
  ).toBe("Original outgoing condition");
});

test("removing pending loan items with historical condition evidence is refused", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["loans.read", "loans.update"],
      { subscriptionTier: "pro" },
    );
  const { loanId, loanItemId, reportId } = await t.run(async (ctx) => {
    const loanId = await ctx.db.insert("loans", {
      organizationId,
      loanNumber: "LEGACY-44",
      type: "outgoing",
      lenderBorrowerName: "Borrower",
      startDate: 100,
      status: "pending",
    });
    const loanItemId = await ctx.db.insert("loanItems", {
      loanId,
      collectionId,
    });
    const reportId = await ctx.db.insert("conditionReports", {
      loanItemId,
      reportType: "out",
      conditionDescription: "Legacy report without pointer",
      assessedBy: userId,
      assessedAt: 100,
    });
    return { loanId, loanItemId, reportId };
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.loans.removeItems, {
      loanId,
      loanItemIds: [loanItemId],
    }),
  ).rejects.toThrow("Permanent evidence");
  expect(
    (await staff.query(api.loans.getConditionReport, { reportId }))
      ?.conditionDescription,
  ).toBe("Legacy report without pointer");
});

test("cancelled transit deletion cannot erase historical movement evidence", async () => {
  const t = createConvexTest();
  const { organizationId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "pro" },
    );
  const transitRecordId = await t.run(async (ctx) =>
    ctx.db.insert("transitRecords", {
      organizationId,
      transitNumber: "TRANSIT-42",
      transitType: "internal",
      originName: "Store",
      destinationName: "Gallery",
      carrier: "Internal",
      status: "cancelled",
      conditionAtPickup: "Original observed condition",
      createdBy: userId,
      createdAt: 100,
    }),
  );
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.transit.deleteTransitRecord, { transitRecordId }),
  ).rejects.toThrow("Permanent evidence");
  expect(
    (await staff.query(api.transit.getTransitRecord, { transitRecordId }))
      ?.conditionAtPickup,
  ).toBe("Original observed condition");
});

test("specialist detail deletion retains provenance and valuation on the same object", async () => {
  const t = createConvexTest();
  const { collectionId, userId } = await createOrgUserCollectionWithPermissions(
    t,
    ["collections.read", "collections.update", "collections.delete"],
    { subscriptionTier: "pro", enabledModules: ["fine_art"] },
  );
  const staff = authedForUser(t, userId);
  const fineArtDetailsId = await staff.mutation(api.fineArtDetails.upsert, {
    collectionId,
    appraisedValue: 1234,
    provenanceChain: [
      { eventType: "gift", owner: "Original donor", verified: false },
    ],
  });
  await expect(
    staff.mutation(api.fineArtDetails.remove, { fineArtDetailsId }),
  ).rejects.toThrow("Permanent evidence");
  const details = await staff.query(api.fineArtDetails.get, { collectionId });
  expect(details?._id).toBe(fineArtDetailsId);
  expect(details?.provenanceChain?.[0]?.owner).toBe("Original donor");
});

test("exhibition document deletion preserves documentary originals", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["collections.read", "collections.delete"],
      { subscriptionTier: "pro" },
    );
  const { exhibitionId, documentId } = await t.run(async (ctx) => {
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Historic exhibition",
      location: "Gallery",
      startDate: 100,
      endDate: 200,
      isCurrent: false,
      isLoan: false,
      status: "closed",
    });
    const storageId = await ctx.storage.store(new Blob(["Floor plan"]));
    const documentId = await ctx.db.insert("exhibitionDocuments", {
      exhibitionId,
      storageId,
      documentType: "floor_plan",
      fileName: "plan.pdf",
      uploadedBy: userId,
      uploadedAt: 100,
    });
    return { exhibitionId, documentId };
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.exhibitions.deleteDocument, { documentId }),
  ).rejects.toThrow("Permanent evidence");
  const documents = await staff.query(api.exhibitions.listDocuments, {
    exhibitionId,
  });
  expect(documents.map((file) => file._id)).toEqual([documentId]);
  expect(documents[0]?.url).toBeTruthy();
});

test("closed exhibition deletion retains the historical exhibition identity", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["collections.read", "collections.delete"],
      { subscriptionTier: "pro" },
    );
  const id = await t.run(async (ctx) =>
    ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Historic exhibition",
      startDate: 100,
      isCurrent: false,
      isLoan: false,
      status: "closed",
    }),
  );
  const staff = authedForUser(t, userId);
  await expect(staff.mutation(api.exhibitions.remove, { id })).rejects.toThrow(
    "Permanent evidence",
  );
  expect((await staff.query(api.exhibitions.get, { id }))?.title).toBe(
    "Historic exhibition",
  );
});

test("completed installation deletion retains its task and completion evidence", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["collections.read", "collections.delete"],
      { subscriptionTier: "pro" },
    );
  const taskId = await t.run(async (ctx) => {
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Gallery exhibition",
      startDate: 100,
      isCurrent: true,
      isLoan: false,
    });
    return ctx.db.insert("installationTasks", {
      organizationId,
      exhibitionId,
      title: "Mount installed",
      taskType: "mounts",
      status: "completed",
      priority: "medium",
      completedBy: userId,
      completedAt: 100,
      createdBy: userId,
      createdAt: 90,
    });
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.installations.deleteTask, { taskId }),
  ).rejects.toThrow("Permanent evidence");
  expect(
    (await staff.query(api.installations.getTask, { taskId }))?.completedAt,
  ).toBe(100);
});

test("removing completed installation checklist evidence is refused", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId, userId } =
    await createOrgUserCollectionWithPermissions(
      t,
      ["collections.read", "collections.delete"],
      { subscriptionTier: "pro" },
    );
  const { taskId, checklistItemId } = await t.run(async (ctx) => {
    const exhibitionId = await ctx.db.insert("exhibitions", {
      organizationId,
      collectionId,
      title: "Exhibition",
      startDate: 100,
      isCurrent: true,
      isLoan: false,
    });
    const taskId = await ctx.db.insert("installationTasks", {
      organizationId,
      exhibitionId,
      title: "Mount",
      taskType: "mounts",
      status: "todo",
      priority: "medium",
      createdBy: userId,
      createdAt: 90,
    });
    const checklistItemId = await ctx.db.insert("installationTaskChecklists", {
      taskId,
      item: "Mount secured",
      completed: true,
      completedBy: userId,
      completedAt: 100,
      sortOrder: 0,
    });
    return { taskId, checklistItemId };
  });
  const staff = authedForUser(t, userId);
  await expect(
    staff.mutation(api.installations.removeChecklistItem, { checklistItemId }),
  ).rejects.toThrow("Permanent evidence");
  expect(
    (await staff.query(api.installations.getTask, { taskId }))
      ?.checklistItems?.[0],
  ).toMatchObject({
    _id: checklistItemId,
    completed: true,
    item: "Mount secured",
  });
});

test("legacy retained-record review is bounded, rerunnable and preserves identity without inventing reasons", async () => {
  const t = createConvexTest();
  const { organizationId, userId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, ["collections.read"]);
  await t.run(async (ctx) =>
    ctx.db.patch(collectionId, {
      status: "deleted",
      title: "Legacy object",
      accessionNumber: "LEGACY-42",
    }),
  );
  const staff = authedForUser(t, userId);
  const args = {
    organizationId,
    status: "deleted" as const,
    paginationOpts: { numItems: 1, cursor: null },
  };
  const review = await staff.query(
    api.organizationCleanup.reviewRetainedCollections,
    args,
  );
  expect(review.page).toEqual([
    {
      collectionId,
      title: "Legacy object",
      accessionNumber: "LEGACY-42",
      withdrawalReason: null,
      requiresReview: true,
    },
  ]);
  expect(
    await staff.query(api.organizationCleanup.reviewRetainedCollections, args),
  ).toEqual(review);
  await expect(
    t.query(api.organizationCleanup.reviewRetainedCollections, args),
  ).rejects.toThrow();
});

test("advancing accession approval retains original votes and excludes cleared votes from later steps", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } =
    await createOrgUserCollectionWithPermissions(t, [
      "collections.read",
      "collections.approve_accession",
      "organization.manage_settings",
    ]);
  const accessionId = await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId,
          name: "First approval",
          approvalMode: "multi",
          requiredApprovals: 1,
        },
        { stepNumber: 2, roleId, name: "Final approval" },
      ],
      canInitiateRoles: [roleId],
    });
    return ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "VOTES-42",
      dateReceived: 100,
      source: "Donor",
      method: "gift",
      status: "pending",
      workflowStep: 1,
    });
  });
  const staff = authedForUser(t, userId);
  await staff.mutation(api.accessions.approve, {
    accessionId,
    comment: "Original first vote",
  });
  expect(
    (await staff.query(api.accessions.get, { accessionId }))?.workflowStep,
  ).toBe(2);
  const history = await staff.query(api.workflows.listRetainedApprovals, {
    organizationId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(history.page).toHaveLength(1);
  expect(history.page[0]).toMatchObject({
    entityId: accessionId,
    approvedBy: userId,
    comment: "Original first vote",
    stepNumber: 1,
  });
  expect(history.page[0]?.clearedAt).toBeTypeOf("number");
  await staff.mutation(api.accessions.approve, {
    accessionId,
    comment: "Final vote",
  });
  expect((await staff.query(api.accessions.get, { accessionId }))?.status).toBe(
    "approved",
  );
});
