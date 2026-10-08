import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { accessionReviewErrorFromError } from "../convex/utils/accessionReview";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const REGISTRAR_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "collections.approve_accession",
  "media.upload",
];

const CATALOGUER_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "media.upload",
];

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  roleName: string,
  permissionNames: string[],
) {
  return t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        email: `${roleName.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        name: roleName,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: roleName,
        isSystemRole: false,
      }),
    ]);
    for (const name of permissionNames) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: name.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return { userId, roleId };
  });
}

async function reviewErrorCode(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return accessionReviewErrorFromError(error)?.code ?? error;
  }
  throw new Error("Expected the call to be rejected");
}

/**
 * A cataloguer submits a new object with an image, a storage location and a
 * collection group for registrar review, as the intake form does.
 */
async function submittedIntake() {
  const t = createConvexTest();
  const registrarSetup = await createOrgUserWithPermissions(
    t,
    REGISTRAR_PERMISSIONS,
    { roleName: "Registrar", userName: "Rita Registrar" },
  );
  const { organizationId } = registrarSetup;
  const cataloguerSetup = await addMember(
    t,
    organizationId,
    "Cataloguer",
    CATALOGUER_PERMISSIONS,
  );
  const fixture = await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId: registrarSetup.roleId,
          name: "Registrar Review",
        },
      ],
      canInitiateRoles: [registrarSetup.roleId, cataloguerSetup.roleId],
    });
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Store A",
      locationCode: "S-A",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    });
    const collectionGroupId = await ctx.db.insert("collectionGroups", {
      organizationId,
      name: "Paintings",
      createdAt: Date.now(),
      createdBy: registrarSetup.userId,
    });
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(12)], { type: "image/png" }),
    );
    await ctx.db.insert("storageOwnership", {
      storageId,
      organizationId,
      uploadedBy: cataloguerSetup.userId,
      uploadedAt: Date.now(),
    });
    return { locationId, collectionGroupId, storageId };
  });
  const registrar = authedForUser(t, registrarSetup.userId);
  const cataloguer = authedForUser(t, cataloguerSetup.userId);
  const objectData = {
    accessionNumber: "INTAKE-001",
    title: "Harbour at dusk",
    currentLocationId: fixture.locationId,
    collectionGroupIds: [fixture.collectionGroupId],
  };
  const draftMedia = [
    {
      storageId: fixture.storageId,
      fileName: "harbour.png",
      fileSize: 12,
      mimeType: "image/png",
      mediaCategory: "image" as const,
      isPrimary: true,
    },
  ];
  const accessionId = await cataloguer.mutation(
    api.accessions.upsertObjectDraft,
    { organizationId, saveMode: "submit", objectData, draftMedia },
  );
  return {
    t,
    organizationId,
    registrarRoleId: registrarSetup.roleId,
    registrar,
    cataloguer,
    accessionId,
    objectData,
    draftMedia,
    ...fixture,
  };
}

test("sending a submitted intake back to draft returns it to the Draft column with the reason", async () => {
  const { registrar, organizationId, accessionId } = await submittedIntake();

  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "returnToDraft",
    reason: "Add the frame dimensions",
  });

  const accession = await registrar.query(api.accessions.get, { accessionId });
  expect(accession).toMatchObject({
    status: "pending",
    workflowStep: 0,
    reviewDecision: {
      decision: "returned_to_draft",
      reason: "Add the frame dimensions",
      decidedByName: "Rita Registrar",
      fromStep: 1,
    },
  });
  const draftColumn = await registrar.query(api.accessions.listBoardColumn, {
    organizationId,
    column: { kind: "step", step: 0 },
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(draftColumn.page.map((row) => row._id)).toEqual([accessionId]);
});

test("the submitter can edit and resubmit an intake sent back to draft", async () => {
  const {
    registrar,
    cataloguer,
    organizationId,
    accessionId,
    objectData,
    draftMedia,
  } = await submittedIntake();
  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "returnToDraft",
    reason: "Add the frame dimensions",
  });

  await cataloguer.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    accessionId,
    saveMode: "submit",
    objectData: { ...objectData, dimensions: "40 x 60 cm" },
    draftMedia,
  });
  const resubmitted = await cataloguer.query(api.accessions.get, {
    accessionId,
  });
  expect(resubmitted).toMatchObject({
    status: "pending",
    workflowStep: 1,
    canCurrentUserApprove: false,
  });
  expect(resubmitted?.draftObjectData?.dimensions).toBe("40 x 60 cm");
  const backInReview = await registrar.query(api.accessions.get, {
    accessionId,
  });
  expect(backInReview?.canCurrentUserApprove).toBe(true);
});

test("withdrawing an intake with media, location and group retains it outside active review without creating an object or deaccession", async () => {
  const { registrar, organizationId, accessionId, storageId } =
    await submittedIntake();

  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "withdraw",
    reason: "Donor withdrew the offer",
  });

  const accession = await registrar.query(api.accessions.get, { accessionId });
  expect(accession).toMatchObject({
    status: "withdrawn",
    canCurrentUserApprove: false,
    reviewDecision: {
      decision: "withdrawn",
      reason: "Donor withdrew the offer",
      fromStep: 1,
    },
    draftObjectData: { title: "Harbour at dusk" },
  });
  expect(accession?.collectionId).toBeUndefined();
  expect(accession?.draftMedia).toMatchObject([
    { storageId, url: expect.any(String) },
  ]);

  const counts = await registrar.query(api.accessions.getBoardCounts, {
    organizationId,
  });
  expect(counts).toMatchObject({ pending: 0, rejected: 0, withdrawn: 1 });
  const column = (kind: "step" | "withdrawn", step = 0) =>
    registrar.query(api.accessions.listBoardColumn, {
      organizationId,
      column: kind === "step" ? { kind, step } : { kind },
      paginationOpts: { numItems: 10, cursor: null },
    });
  expect((await column("step", 0)).page).toEqual([]);
  expect((await column("step", 1)).page).toEqual([]);
  expect((await column("withdrawn")).page.map((row) => row._id)).toEqual([
    accessionId,
  ]);

  const objects = await registrar.query(api.collections.list, {
    organizationId,
    includeDeaccessioned: true,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(objects.page).toEqual([]);
  const deaccessions = await registrar.query(api.deaccessions.list, {
    organizationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(deaccessions.page).toEqual([]);
});

test("only a reviewer for the current step can reject, and a refused rejection writes nothing", async () => {
  const { t, organizationId, cataloguer, accessionId } =
    await submittedIntake();
  const otherApprover = await addMember(t, organizationId, "Curator", [
    "collections.read",
    "collections.approve_accession",
  ]);

  expect(
    await reviewErrorCode(
      cataloguer.mutation(api.accessions.reject, {
        accessionId,
        decision: "withdraw",
        reason: "Not ours to keep",
      }),
    ),
  ).toBe("NOT_PERMITTED");
  expect(
    await reviewErrorCode(
      authedForUser(t, otherApprover.userId).mutation(api.accessions.reject, {
        accessionId,
        decision: "returnToDraft",
        reason: "Needs more photos",
      }),
    ),
  ).toBe("NOT_PERMITTED");

  const accession = await cataloguer.query(api.accessions.get, {
    accessionId,
  });
  expect(accession).toMatchObject({ status: "pending", workflowStep: 1 });
  expect(accession?.reviewDecision).toBeUndefined();
});

test("a rejection needs a reason, and replaying a decision is refused without changing the record", async () => {
  const { registrar, accessionId } = await submittedIntake();

  expect(
    await reviewErrorCode(
      registrar.mutation(api.accessions.reject, {
        accessionId,
        decision: "withdraw",
        reason: "   ",
      }),
    ),
  ).toBe("REASON_REQUIRED");

  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "returnToDraft",
    reason: "Add the frame dimensions",
  });
  for (const decision of ["returnToDraft", "withdraw"] as const) {
    expect(
      await reviewErrorCode(
        registrar.mutation(api.accessions.reject, {
          accessionId,
          decision,
          reason: "Second click",
        }),
      ),
    ).toBe("NOT_IN_REVIEW");
  }

  const accession = await registrar.query(api.accessions.get, { accessionId });
  expect(accession).toMatchObject({
    status: "pending",
    workflowStep: 0,
    reviewDecision: {
      decision: "returned_to_draft",
      reason: "Add the frame dimensions",
    },
  });
});

test("a withdrawn intake cannot be rejected again", async () => {
  const { registrar, accessionId } = await submittedIntake();
  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "withdraw",
    reason: "Donor withdrew the offer",
  });

  expect(
    await reviewErrorCode(
      registrar.mutation(api.accessions.reject, {
        accessionId,
        decision: "withdraw",
        reason: "Second click",
      }),
    ),
  ).toBe("NOT_IN_REVIEW");
  expect(
    (await registrar.query(api.accessions.get, { accessionId }))?.reviewDecision
      ?.reason,
  ).toBe("Donor withdrew the offer");
});

test("reject decisions are audited, kept in the case history and explained to the submitter", async () => {
  const { registrar, cataloguer, organizationId, accessionId } =
    await submittedIntake();

  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "returnToDraft",
    reason: "Add the frame dimensions",
  });
  await cataloguer.mutation(api.accessions.submitForApproval, { accessionId });
  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "withdraw",
    reason: "Donor withdrew the offer",
  });

  const audit = await registrar.query(api.auditLog.getByEntity, {
    organizationId,
    entityType: "accession",
    entityId: accessionId,
  });
  expect(
    audit
      .filter((entry) => entry.action !== "submitted_object_accession")
      .map((entry) => [entry.action, entry.changes?.reason]),
  ).toEqual([
    ["withdrawn", "Donor withdrew the offer"],
    ["returned_to_draft", "Add the frame dimensions"],
  ]);

  const history = await registrar.query(api.auditLog.listCaseHistory, {
    organizationId,
    caseType: "accession",
    entityId: accessionId,
  });
  expect(history.entries.map(({ entry }) => entry.comment)).toEqual([
    "Submitted object request",
    "Returned to draft: Add the frame dimensions",
    "Withdrawn: Donor withdrew the offer",
  ]);

  const { notifications } = await cataloguer.query(
    api.audit.listNotifications,
    { organizationId },
  );
  expect(notifications.map((notification) => notification.message)).toEqual([
    expect.stringContaining("Donor withdrew the offer"),
    expect.stringContaining("Add the frame dimensions"),
  ]);
});

test("an approver can restore a withdrawn intake to Draft with a reason", async () => {
  const { registrar, cataloguer, organizationId, accessionId, storageId } =
    await submittedIntake();
  await registrar.mutation(api.accessions.reject, {
    accessionId,
    decision: "withdraw",
    reason: "Donor withdrew the offer",
  });
  expect(
    (await registrar.query(api.accessions.get, { accessionId }))
      ?.canCurrentUserRestore,
  ).toBe(true);
  expect(
    (await cataloguer.query(api.accessions.get, { accessionId }))
      ?.canCurrentUserRestore,
  ).toBe(false);

  expect(
    await reviewErrorCode(
      cataloguer.mutation(api.accessions.restoreWithdrawn, {
        accessionId,
        reason: "Donor changed their mind",
      }),
    ),
  ).toBe("NOT_PERMITTED");
  expect(
    await reviewErrorCode(
      registrar.mutation(api.accessions.restoreWithdrawn, {
        accessionId,
        reason: "",
      }),
    ),
  ).toBe("REASON_REQUIRED");

  await registrar.mutation(api.accessions.restoreWithdrawn, {
    accessionId,
    reason: "Donor changed their mind",
  });

  const restored = await registrar.query(api.accessions.get, { accessionId });
  expect(restored).toMatchObject({
    status: "pending",
    workflowStep: 0,
    canCurrentUserRestore: false,
    reviewDecision: {
      decision: "restored",
      reason: "Donor changed their mind",
      fromStep: 1,
    },
  });
  expect(restored?.draftMedia).toMatchObject([{ storageId }]);
  expect(
    await reviewErrorCode(
      registrar.mutation(api.accessions.restoreWithdrawn, {
        accessionId,
        reason: "Second click",
      }),
    ),
  ).toBe("NOT_WITHDRAWN");
  const [latest] = await registrar.query(api.auditLog.getByEntity, {
    organizationId,
    entityType: "accession",
    entityId: accessionId,
  });
  expect(latest).toMatchObject({
    action: "restored",
    changes: { reason: "Donor changed their mind" },
  });
});

test("legacy rejected accessions keep their status and count, and cannot be rejected or restored again", async () => {
  const { t, registrar, organizationId } = await submittedIntake();
  const legacyId = await t.run(async (ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "LEGACY-REJ-1",
      dateReceived: Date.now(),
      source: "Estate sale",
      method: "gift",
      status: "rejected",
      workflowStep: -2,
    }),
  );

  expect(
    await registrar.query(api.accessions.getBoardCounts, { organizationId }),
  ).toMatchObject({ rejected: 1, withdrawn: 0 });
  expect(
    await registrar.query(api.accessions.get, { accessionId: legacyId }),
  ).toMatchObject({ status: "rejected", canCurrentUserRestore: false });
  expect(
    await reviewErrorCode(
      registrar.mutation(api.accessions.reject, {
        accessionId: legacyId,
        decision: "returnToDraft",
        reason: "Reopen",
      }),
    ),
  ).toBe("NOT_IN_REVIEW");
  expect(
    await reviewErrorCode(
      registrar.mutation(api.accessions.restoreWithdrawn, {
        accessionId: legacyId,
        reason: "Reopen",
      }),
    ),
  ).toBe("NOT_WITHDRAWN");
});
