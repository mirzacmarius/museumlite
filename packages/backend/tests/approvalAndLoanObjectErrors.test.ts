import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { accessionReviewErrorFromError } from "../convex/utils/accessionReview";
import { loanObjectErrorFromError } from "../convex/utils/loanObjectErrors";
import { workflowApprovalErrorFromError } from "../convex/utils/workflowApprovalErrors";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

type ConvexTest = ReturnType<typeof createConvexTest>;

/** The stable code a refused call carries, so the app can translate it. */
async function refusalCode(
  call: Promise<unknown>,
  read: (error: unknown) => { code: string } | null,
) {
  try {
    await call;
  } catch (error) {
    return read(error)?.code ?? error;
  }
  throw new Error("Expected the call to be rejected");
}

async function accessionInReview(
  t: ConvexTest,
  step: {
    approverIsCaller: boolean;
    approvalMode?: "single" | "multi" | "unanimous";
    requiredApprovals?: number;
    requireSourceVerification?: boolean;
  },
) {
  const setup = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
    "collections.approve_accession",
  ]);
  const approverRoleId = step.approverIsCaller
    ? setup.roleId
    : await t.run((ctx) =>
        ctx.db.insert("roles", {
          organizationId: setup.organizationId,
          name: "Registrar",
          isSystemRole: false,
        }),
      );
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "accession",
      steps: [
        {
          stepNumber: 1,
          roleId: approverRoleId,
          name: "Registrar review",
          approvalMode: step.approvalMode,
          requiredApprovals: step.requiredApprovals,
        },
      ],
      canInitiateRoles: [setup.roleId],
      requireSourceVerification: step.requireSourceVerification,
    }),
  );
  const authed = authedForUser(t, setup.userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId: setup.organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: `ACC-${Math.random().toString(36).slice(2, 8)}`,
      title: "Bronze figure",
    },
  });
  return { ...setup, authed, accessionId };
}

test("an approver without the step's role is refused with a code the app translates", async () => {
  const t = createConvexTest();
  const { authed, accessionId } = await accessionInReview(t, {
    approverIsCaller: false,
  });

  expect(
    await refusalCode(
      authed.mutation(api.accessions.approve, { accessionId }),
      workflowApprovalErrorFromError,
    ),
  ).toBe("APPROVAL_NOT_PERMITTED");
});

test("approving the same step twice is refused as already approved", async () => {
  const t = createConvexTest();
  const { authed, accessionId } = await accessionInReview(t, {
    approverIsCaller: true,
    approvalMode: "multi",
    requiredApprovals: 2,
  });
  await authed.mutation(api.accessions.approve, { accessionId });

  expect(
    await refusalCode(
      authed.mutation(api.accessions.approve, { accessionId }),
      workflowApprovalErrorFromError,
    ),
  ).toBe("ALREADY_APPROVED");
  const accession = await authed.query(api.accessions.get, { accessionId });
  expect(accession?.status).toBe("pending");
});

test("an accession missing required source verification is refused with a code", async () => {
  const t = createConvexTest();
  const { authed, accessionId } = await accessionInReview(t, {
    approverIsCaller: true,
    requireSourceVerification: true,
  });

  expect(
    await refusalCode(
      authed.mutation(api.accessions.approve, { accessionId }),
      accessionReviewErrorFromError,
    ),
  ).toBe("SOURCE_VERIFICATION_REQUIRED");
});

test("submitting under a workflow without steps is refused as not configured", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, [
    "collections.create",
    "collections.read",
    "collections.update",
  ]);
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "accession",
      steps: [],
      canInitiateRoles: [setup.roleId],
    }),
  );
  const authed = authedForUser(t, setup.userId);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId: setup.organizationId,
    saveMode: "draft",
    objectData: { accessionNumber: "ACC-NO-STEPS", title: "Glass vessel" },
  });

  expect(
    await refusalCode(
      authed.mutation(api.accessions.submitForApproval, { accessionId }),
      workflowApprovalErrorFromError,
    ),
  ).toBe("WORKFLOW_NOT_CONFIGURED");
});

async function loanDesk(t: ConvexTest) {
  const setup = await createOrgUserWithPermissions(
    t,
    ["loans.create", "loans.read", "loans.update", "collections.read"],
    { subscriptionTier: "pro" },
  );
  const object = (status: "active" | "archived", accessionNumber: string) =>
    t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: setup.organizationId,
        accessionNumber,
        title: `Object ${accessionNumber}`,
        status,
        catalogedBy: setup.userId,
        catalogedAt: Date.now(),
      }),
    );
  const authed = authedForUser(t, setup.userId);
  const createLoan = (collectionId: Id<"collections">) =>
    authed.mutation(api.loans.create, {
      organizationId: setup.organizationId,
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: Date.UTC(2026, 0, 15),
      itemsWithConditions: [{ collectionId }],
    });
  return { ...setup, authed, object, createLoan };
}

test("a loan refuses an object that is already on another loan, with a code", async () => {
  const t = createConvexTest();
  const { object, createLoan } = await loanDesk(t);
  const vase = await object("active", "OBJ-VASE");
  await createLoan(vase);

  expect(await refusalCode(createLoan(vase), loanObjectErrorFromError)).toBe(
    "OBJECT_ON_ACTIVE_LOAN",
  );
});

test("a loan refuses an inactive object, with a code", async () => {
  const t = createConvexTest();
  const { object, createLoan } = await loanDesk(t);
  const withdrawn = await object("archived", "OBJ-WITHDRAWN");

  expect(
    await refusalCode(createLoan(withdrawn), loanObjectErrorFromError),
  ).toBe("OBJECT_NOT_ACTIVE");
});

test("a loan refuses another organization's object without describing it", async () => {
  const t = createConvexTest();
  const { createLoan } = await loanDesk(t);
  const other = await loanDesk(t);
  const foreign = await other.object("active", "OBJ-FOREIGN");

  let caught: unknown;
  try {
    await createLoan(foreign);
  } catch (error) {
    caught = error;
  }
  expect(loanObjectErrorFromError(caught)).toEqual({
    code: "OBJECT_UNAVAILABLE",
    message: "A selected object is not available",
  });
});
