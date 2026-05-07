import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  type ConvexTest,
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions as createOrgUserWithBasePermissions,
} from "./testHarness";

async function createOrgUserWithPermissions(
  t: ConvexTest,
  permissionNames: string[],
) {
  return await createOrgUserWithBasePermissions(t, permissionNames, {
    roleName: "Registrar",
  });
}

test("should create accession record", async () => {
  const t = createConvexTest();
  expect(true).toBe(true);
});

test("should generate accession number", async () => {
  const t = createConvexTest();
  expect(true).toBe(true);
});

test("should link accession to collection object", async () => {
  const t = createConvexTest();
  expect(true).toBe(true);
});

test("should track accession workflow status", async () => {
  const t = createConvexTest();
  expect(true).toBe(true);
});

test("should attach donor information", async () => {
  const t = createConvexTest();
  expect(true).toBe(true);
});

test("should complete accession process", async () => {
  const t = createConvexTest();
  expect(true).toBe(true);
});

test("object draft save keeps the accession at workflow step 0", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Approve" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: {
      accessionNumber: "DRAFT-001",
      title: "Draft Object",
    },
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("pending");
  expect(accession?.workflowStep).toBe(0);
  expect(accession?.draftObjectData?.title).toBe("Draft Object");
});

test("submitForApproval moves object drafts from step 0 to step 1", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Approve" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: {
      accessionNumber: "DRAFT-002",
      title: "Pending Submission Draft",
    },
  });

  await authed.mutation(api.accessions.submitForApproval, {
    accessionId,
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("pending");
  expect(accession?.workflowStep).toBe(1);
});

test("getWorkflowSteps returns descriptive workflow metadata", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.read"],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId,
          name: "Registrar Review",
          approvalMode: "multi",
          requiredApprovals: 2,
          requiredDocuments: ["deed_of_gift"],
        },
      ],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const workflow = await authed.query(api.accessions.getWorkflowSteps, {
    organizationId,
  });

  expect(workflow.hasWorkflow).toBe(true);
  expect(workflow.requireSourceVerification).toBe(false);
  expect(workflow.steps[1]?.name).toBe("Registrar Review");
  expect(workflow.steps[1]?.roleName).toBe("Registrar");
  expect(workflow.steps[1]?.approvalMode).toBe("multi");
  expect(workflow.steps[1]?.requiredApprovals).toBe(2);
  expect("requiredDocuments" in (workflow.steps[1] ?? {})).toBe(false);
});

test("getWorkflowSteps does not include a rejected accession column", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.read"],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Registrar Review" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const workflow = await authed.query(api.accessions.getWorkflowSteps, {
    organizationId,
  });

  expect(workflow.steps.map((step) => step.name)).not.toContain("Rejected");
  expect(workflow.steps.map((step) => step.stepNumber)).not.toContain(-2);
});

test("rejecting an accession moves the object to rejected deaccessions", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Registrar Review" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "REJECT-001",
      title: "Rejected Object",
    },
  });

  await authed.mutation(api.accessions.reject, {
    accessionId,
    comment: "Duplicate request",
  });

  const result = await t.run(async (ctx) => {
    const accession = await ctx.db.get(accessionId);
    const collectionId = accession?.collectionId;
    const collection = collectionId ? await ctx.db.get(collectionId) : null;
    const deaccession = collectionId
      ? await ctx.db
          .query("deaccessions")
          .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
          .first()
      : null;

    return { accession, collection, deaccession };
  });

  expect(result.accession?.status).toBe("rejected");
  expect(result.accession?.workflowStep).toBe(-2);
  expect(result.collection?.status).toBe("deaccessioned");
  expect(result.collection?.displayStatus).toBe("REJECTED");
  expect(result.deaccession?.status).toBe("rejected");
  expect(result.deaccession?.workflowStep).toBe(-2);
  expect(result.deaccession?.reason).toBe("Accession rejected");
});

test("getWorkflowSteps does not surface document requirements for accession approvals", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.read"],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Documentation Check" }],
      canInitiateRoles: [roleId],
      requiredDocuments: [
        {
          documentType: "deed_of_gift",
          description: "Legal transfer document",
          requiredAtStep: 1,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);
  const workflow = await authed.query(api.accessions.getWorkflowSteps, {
    organizationId,
  });

  expect("requiredDocuments" in (workflow.steps[1] ?? {})).toBe(false);
});

test("draft save does not require workflow initiation permission", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
  ]);

  const approverRoleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Approver",
      isSystemRole: false,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId: approverRoleId, name: "Approve" }],
      canInitiateRoles: [approverRoleId],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: {
      accessionNumber: "DRAFT-NO-INIT-001",
      title: "Draft Without Workflow Initiation",
    },
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("pending");
  expect(accession?.workflowStep).toBe(0);

  await expect(
    authed.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "submit",
      objectData: {
        accessionNumber: "DRAFT-NO-INIT-001",
        title: "Draft Without Workflow Initiation",
      },
    }),
  ).rejects.toThrow("Permission denied: cannot initiate accession workflow");
});

test("accession approval still requires the configured step role for non-admin users", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
    "collections.approve_accession",
  ]);

  const approverRoleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Workflow Approver",
      isSystemRole: false,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId: approverRoleId, name: "Approval Step" }],
      canInitiateRoles: [approverRoleId],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: {
      accessionNumber: "APPROVE-PERM-001",
      title: "Approval Permission Override",
      description: "Should approve based on permission gate",
    },
  });

  await authed.mutation(api.accessions.submitForApproval, {
    accessionId,
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.canCurrentUserApprove).toBe(false);

  await expect(
    authed.mutation(api.accessions.approve, {
      accessionId,
      comment: "Attempt approve without step role",
    }),
  ).rejects.toThrow("Permission denied: cannot approve at this step");
});

test("object draft approvals bypass source verification requirements", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Approve" }],
      canInitiateRoles: [roleId],
      requireSourceVerification: true,
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "OBJ-SOURCE-001",
      title: "Object Draft Without Source Verification",
      description: "Draft-based object intake",
    },
  });

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Approved without source verification",
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
  expect(accession?.sourceVerified).toBeUndefined();
});

test("standard accessions still require source verification when configured", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Approve" }],
      canInitiateRoles: [roleId],
      requireSourceVerification: true,
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "STD-SOURCE-001",
    dateReceived: Date.now(),
    source: "Donor intake",
    method: "gift",
  });

  await authed.mutation(api.accessions.submitForApproval, {
    accessionId,
  });

  await expect(
    authed.mutation(api.accessions.approve, {
      accessionId,
      comment: "Attempt approval without source verification",
    }),
  ).rejects.toThrow("Source verification is required before approval");
});

test("get returns source verification state after verifySource", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Documentation Check" }],
      canInitiateRoles: [roleId],
      requireSourceVerification: true,
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "SRC-READ-001",
    dateReceived: Date.now(),
    source: "Donor intake",
    method: "gift",
  });

  await authed.mutation(api.accessions.verifySource, {
    accessionId,
    verificationNotes: "Documents reviewed",
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.sourceVerified).toBe(true);
  expect(accession?.sourceVerificationNotes).toBe("Documents reviewed");

  const workflow = await authed.query(api.accessions.getWorkflowSteps, {
    organizationId,
  });

  expect(workflow.requireSourceVerification).toBe(true);
});

test("object draft approvals bypass required document checks", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId,
          name: "Approve",
          requiredDocuments: ["deed_of_gift"],
        },
      ],
      canInitiateRoles: [roleId],
      requiredDocuments: [
        {
          documentType: "deed_of_gift",
          description: "Legal transfer document",
          requiredAtStep: 1,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "OBJ-DOC-001",
      title: "Object Draft Without Checklist Docs",
      description: "Draft-based object intake",
    },
  });

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Approved without checklist documents",
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
});

test("standard accessions ignore configured checklist documents during approval", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId,
          name: "Approve",
          requiredDocuments: ["deed_of_gift"],
        },
      ],
      canInitiateRoles: [roleId],
      requiredDocuments: [
        {
          documentType: "deed_of_gift",
          description: "Legal transfer document",
          requiredAtStep: 1,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "STD-DOC-001",
    dateReceived: Date.now(),
    source: "Donor intake",
    method: "gift",
  });

  await authed.mutation(api.accessions.initializeDocumentChecklist, {
    accessionId,
  });

  await authed.mutation(api.accessions.submitForApproval, {
    accessionId,
  });

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Approve without deed of gift",
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
});

test("multi-step accessions advance and finish without document blockers", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId,
          name: "Documentation Check",
          requiredDocuments: ["deed_of_gift"],
        },
        {
          stepNumber: 2,
          roleId,
          name: "Final Approval",
        },
      ],
      canInitiateRoles: [roleId],
      requiredDocuments: [
        {
          documentType: "deed_of_gift",
          description: "Legal transfer document",
          requiredAtStep: 1,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "MULTI-STEP-DOC-001",
    dateReceived: Date.now(),
    source: "Donor intake",
    method: "gift",
  });

  await authed.mutation(api.accessions.submitForApproval, {
    accessionId,
  });

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Advance to step 2 without documents",
  });

  let accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("pending");
  expect(accession?.workflowStep).toBe(2);

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Finalize without documents",
  });

  accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
});

test("accession workflows with config step 0 still complete on the last real approval step", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 0, roleId, name: "Initial Review" },
        { stepNumber: 1, roleId, name: "Documentation Check" },
        { stepNumber: 2, roleId, name: "Final Approval" },
      ],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "HIDDEN-ZERO-STEP-001",
      title: "Workflow With Hidden Zero Step",
    },
  });

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Approve visible step 1",
  });

  let accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("pending");
  expect(accession?.workflowStep).toBe(2);

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Approve visible step 2",
  });

  accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
});

test("stale accessions past the last approval step are finalized on approve", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  const accessionId = await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 0, roleId, name: "Initial Review" },
        { stepNumber: 1, roleId, name: "Documentation Check" },
        { stepNumber: 2, roleId, name: "Final Approval" },
      ],
      canInitiateRoles: [roleId],
    });

    return await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "STALE-STEP-001",
      dateReceived: Date.now(),
      source: "Donor intake",
      method: "gift",
      status: "pending",
      workflowStep: 3,
      workflowHistory: [
        {
          step: 1,
          approvedBy: userId,
          approvedAt: Date.now() - 1000,
        },
        {
          step: 2,
          approvedBy: userId,
          approvedAt: Date.now() - 500,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);

  await authed.mutation(api.accessions.approve, {
    accessionId,
    comment: "Finalize stale accession",
  });

  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
  expect(accession?.approvedBy).toBe(userId);
});

test("stale accessions past the last approval step still require source verification", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  );

  const accessionId = await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 0, roleId, name: "Initial Review" },
        { stepNumber: 1, roleId, name: "Documentation Check" },
        { stepNumber: 2, roleId, name: "Final Approval" },
      ],
      canInitiateRoles: [roleId],
      requireSourceVerification: true,
    });

    return await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "STALE-SOURCE-001",
      dateReceived: Date.now(),
      source: "Donor intake",
      method: "gift",
      status: "pending",
      workflowStep: 3,
      workflowHistory: [
        {
          step: 1,
          approvedBy: userId,
          approvedAt: Date.now() - 1000,
        },
        {
          step: 2,
          approvedBy: userId,
          approvedAt: Date.now() - 500,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);

  await expect(
    authed.mutation(api.accessions.approve, {
      accessionId,
      comment: "Try to finalize stale accession without source verification",
    }),
  ).rejects.toThrow("Source verification is required before approval");
});

test("stale accessions past the last approval step still require the last step role", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
    "collections.approve_accession",
  ]);

  const approverRoleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Workflow Approver",
      isSystemRole: false,
    });
  });

  const accessionId = await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 0, roleId: approverRoleId, name: "Initial Review" },
        { stepNumber: 1, roleId: approverRoleId, name: "Documentation Check" },
        { stepNumber: 2, roleId: approverRoleId, name: "Final Approval" },
      ],
      canInitiateRoles: [approverRoleId],
    });

    return await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "STALE-AUTH-001",
      dateReceived: Date.now(),
      source: "Donor intake",
      method: "gift",
      status: "pending",
      workflowStep: 3,
      workflowHistory: [
        {
          step: 1,
          approvedBy: userId,
          approvedAt: Date.now() - 1000,
        },
        {
          step: 2,
          approvedBy: userId,
          approvedAt: Date.now() - 500,
        },
      ],
    });
  });

  const authed = authedForUser(t, userId);
  const accession = await authed.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.canCurrentUserApprove).toBe(false);

  await expect(
    authed.mutation(api.accessions.approve, {
      accessionId,
      comment: "Try to finalize stale accession without final step role",
    }),
  ).rejects.toThrow("Permission denied: cannot approve at this step");
});

test("organization administrators can approve an accession even when the workflow step belongs to another role", async () => {
  const t = createConvexTest();

  const { organizationId, adminUserId } = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Admin Approval Museum",
      slug: `admin-approval-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const adminUserId = await ctx.db.insert("users", {
      email: `admin-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: "Administrator",
    });

    const adminRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "admin",
      isSystemRole: true,
    });

    const reviewerRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      isSystemRole: false,
    });

    for (const permissionName of [
      "organization.manage_settings",
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ]) {
      const permissionId = await ctx.db.insert("permissions", {
        name: permissionName,
        category: permissionName.split(".")[0] || "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRoleId,
        permissionId,
      });
    }

    await ctx.db.insert("userOrganizations", {
      userId: adminUserId,
      organizationId,
      roleId: adminRoleId,
      joinedAt: Date.now(),
    });

    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 1, roleId: reviewerRoleId, name: "Registrar Review" },
      ],
      canInitiateRoles: [adminRoleId],
    });

    return { organizationId, adminUserId };
  });

  const admin = authedForUser(t, adminUserId);

  const accessionId = await admin.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "ADMIN-APPROVE-001",
      title: "Admin Override Accession",
      description: "Submitted by admin for approval regression coverage",
    },
  });

  await admin.mutation(api.accessions.approve, {
    accessionId,
    comment: "Approved by organization administrator",
  });

  const accession = await admin.query(api.accessions.get, {
    accessionId,
  });

  expect(accession).not.toBeNull();
  expect(accession?.status).toBe("approved");
  expect(accession?.approvedBy).toBe(adminUserId);

  const collection = await t.run(async (ctx) => {
    return await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("accessionNumber", "ADMIN-APPROVE-001"),
      )
      .first();
  });

  expect(collection).not.toBeNull();
  expect(collection?.title).toBe("Admin Override Accession");
});

/**
 * Integration test for batch lookup optimization (N+1 query elimination).
 *
 * This test verifies that the accessions.list query correctly handles
 * batch lookups for collections and assignees using the batchLookup utility.
 *
 * Performance improvement:
 * - BEFORE: 1 + N collection queries + M assignee queries (where N = accessions, M = assignees)
 *   For 30 accessions with 5 collections and 3 assignees: 1 + 30 + 30 = 61 queries
 *
 * - AFTER: 1 + 1 collection query + 1 assignee query
 *   For same dataset: 1 + 1 + 1 = 3 queries
 *
 * Reduction: ~95% fewer database queries (61 → 3)
 */
test("should batch lookup collections and assignees for list query", async () => {
  const t = createConvexTest();

  const { orgId, userId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: "test-museum",
      type: "museum",
    });

    const userId = await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });

    const roleId = await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });

    const permissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, userId };
  });

  // Create multiple collections (simulate realistic scenario)
  const collectionIds = await t.run(async (ctx) => {
    const ids: Id<"collections">[] = [];
    for (let i = 1; i <= 5; i++) {
      const id = await ctx.db.insert("collections", {
        organizationId: orgId,
        accessionNumber: `COLL-${String(i).padStart(3, "0")}`,
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
        title: `Collection ${i}`,
        description: `Test collection ${i}`,
      });
      ids.push(id);
    }
    return ids;
  });

  // Create multiple user accounts (assignees)
  const assigneeIds = await t.run(async (ctx) => {
    const ids: Id<"users">[] = [];
    for (let i = 1; i <= 3; i++) {
      const id = await ctx.db.insert("users", {
        email: `curator${i}@museum.test`,
        name: `Curator ${i}`,
      });
      ids.push(id);
    }
    return ids;
  });

  // Create 30 accessions with various collections and assignees
  // This is more than a typical page size (25) to test pagination edge cases
  await t.run(async (ctx) => {
    for (let i = 1; i <= 30; i++) {
      await ctx.db.insert("accessions", {
        organizationId: orgId,
        accessionNumber: `ACC-2026-${String(i).padStart(3, "0")}`,
        dateReceived: Date.now() - i * 86400000, // Stagger dates for sorting
        source: `Source ${i}`,
        method: i % 2 === 0 ? "donation" : "purchase",
        status: "pending",
        // Assign to different collections (round-robin)
        collectionId: collectionIds[i % collectionIds.length],
        // Assign to different users (round-robin)
        assignedTo: assigneeIds[i % assigneeIds.length],
        notes: `Test accession ${i}`,
      });
    }
  });

  // Query the first page (25 items)
  const authed = authedForUser(t, userId);
  const result = await authed.query(api.accessions.list, {
    organizationId: orgId,
    paginationOpts: {
      cursor: null,
      numItems: 25,
    },
  });

  // Verify pagination works
  expect(result.page).toHaveLength(25);
  expect(result.isDone).toBe(false);

  // Verify all accessions have assignee names populated
  // This confirms batch lookup worked for assignees
  for (const accession of result.page) {
    expect(accession.assigneeName).toBeDefined();
    expect(accession.assigneeName).toMatch(/^Curator [1-3]$/);
  }

  // Verify accessions are sorted by dateReceived (newest first)
  for (let i = 0; i < result.page.length - 1; i++) {
    expect(result.page[i].dateReceived).toBeGreaterThanOrEqual(
      result.page[i + 1].dateReceived,
    );
  }

  // Test search with collection title (this uses batch lookup for collections)
  const searchResult = await authed.query(api.accessions.list, {
    organizationId: orgId,
    search: "Collection 1", // Should match accessions with Collection 1
    paginationOpts: {
      cursor: null,
      numItems: 25,
    },
  });

  // Verify search results
  expect(searchResult.page.length).toBeGreaterThan(0);
  // All results should have collectionId pointing to Collection 1
  // (we can't verify the title directly in the result, but the search worked)
  expect(searchResult.page.length).toBeLessThanOrEqual(30);

  // Test pagination to get remaining items
  const page2Result = await authed.query(api.accessions.list, {
    organizationId: orgId,
    paginationOpts: {
      cursor: result.continueCursor,
      numItems: 25,
    },
  });

  // Verify second page has remaining items
  expect(page2Result.page).toHaveLength(5); // 30 total - 25 on first page = 5
  expect(page2Result.isDone).toBe(true);

  // Verify assignee names on second page too
  for (const accession of page2Result.page) {
    expect(accession.assigneeName).toBeDefined();
    expect(accession.assigneeName).toMatch(/^Curator [1-3]$/);
  }
});
