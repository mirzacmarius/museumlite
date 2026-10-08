import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

const conservationPermissions = [
  "collections.read",
  "collections.update",
  "collections.create",
  "collections.approve_conservation",
  "collections.accept_condition",
] as const;

async function setupConservationWithAssessments() {
  const t = createConvexTest();
  const setup = await createOrgUserCollectionWithPermissions(
    t,
    [...conservationPermissions],
    {
      subscriptionTier: "pro",
      roleName: "Conservator",
    },
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "conservation",
      steps: [{ stepNumber: 1, roleId: setup.roleId, name: "Approve" }],
      canInitiateRoles: [setup.roleId],
    });
  });

  const authed = authedForUser(t, setup.userId);

  const baselineId = await authed.mutation(api.conditionAssessments.create, {
    collectionId: setup.collectionId,
    assessedAt: Date.UTC(2026, 8, 1),
    condition: "Fair",
    summary: "Before treatment",
    observations: [
      { area: "Surface", description: "Minor abrasion", severity: "minor" },
    ],
    photos: [],
  });
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: baselineId,
  });

  return { t, authed, ...setup, baselineId };
}

async function createAcceptedOutcome(
  authed: ReturnType<typeof authedForUser>,
  collectionId: Id<"collections">,
  condition: string,
) {
  const outcomeId = await authed.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 8, 15),
    condition,
    summary: "After treatment",
    observations: [
      { area: "Surface", description: "Stabilized", severity: "minor" },
    ],
    photos: [],
  });
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: outcomeId,
  });
  return outcomeId;
}

describe("Conservation treatment assessment evidence", () => {
  test("approve requires a retained baseline assessment", async () => {
    const { t, authed, collectionId, userId } =
      await setupConservationWithAssessments();

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "cleaning",
      title: "Surface cleaning",
      description: "Remove grime",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(treatmentId, { baselineAssessmentId: undefined });
    });

    await expect(
      authed.mutation(api.conservationTreatments.approve, { treatmentId }),
    ).rejects.toThrow(/baseline/i);

    const baselineOnly = await authed.mutation(
      api.conditionAssessments.create,
      {
        collectionId,
        assessedAt: Date.UTC(2026, 8, 2),
        condition: "Fair",
        summary: "Dedicated baseline",
        observations: [
          { area: "Base", description: "Stable", severity: "minor" },
        ],
        photos: [],
      },
    );
    await authed.mutation(api.conservationTreatments.linkBaselineAssessment, {
      treatmentId,
      assessmentId: baselineOnly,
    });

    await authed.mutation(api.conservationTreatments.approve, { treatmentId });
    const treatment = await t.run(async (ctx) => ctx.db.get(treatmentId));
    expect(treatment?.status).toBe("approved");
    expect(treatment?.baselineAssessmentId).toBe(baselineOnly);
    expect(userId).toBeDefined();
  });

  test("cannot complete without an accepted outcome assessment", async () => {
    const { authed, collectionId } = await setupConservationWithAssessments();

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "repair",
      title: "Tear repair",
      description: "Mend canvas tear",
    });

    await authed.mutation(api.conservationTreatments.approve, { treatmentId });
    await authed.mutation(api.conservationTreatments.startProgress, {
      treatmentId,
    });

    await expect(
      authed.mutation(api.conservationTreatments.complete, {
        treatmentId,
        notes: "Done",
      }),
    ).rejects.toThrow(/outcome/i);

    const draftOutcome = await authed.mutation(
      api.conditionAssessments.create,
      {
        collectionId,
        assessedAt: Date.UTC(2026, 8, 20),
        condition: "Good",
        summary: "Draft outcome",
        observations: [
          { area: "Canvas", description: "Repaired", severity: "minor" },
        ],
        photos: [],
      },
    );
    await authed.mutation(api.conservationTreatments.linkOutcomeAssessment, {
      treatmentId,
      assessmentId: draftOutcome,
    });

    await expect(
      authed.mutation(api.conservationTreatments.complete, {
        treatmentId,
      }),
    ).rejects.toThrow(/accepted/i);

    await authed.mutation(api.conditionAssessments.accept, {
      assessmentId: draftOutcome,
    });
    await authed.mutation(api.conservationTreatments.complete, {
      treatmentId,
      notes: "Verified",
    });

    const evidence = await authed.query(
      api.conservationTreatments.getTreatmentEvidence,
      { treatmentId },
    );
    expect(evidence.status).toBe("completed");
    expect(evidence.outcome?.status).toBe("accepted");
    expect(evidence.comparison.baselineCondition).toBe("Fair");
    expect(evidence.comparison.outcomeCondition).toBe("Good");
  });

  test("create captures current accepted assessment as baseline", async () => {
    const { authed, collectionId, baselineId } =
      await setupConservationWithAssessments();

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "stabilization",
      title: "Climate stabilization",
      description: "Stabilize RH",
    });

    const evidence = await authed.query(
      api.conservationTreatments.getTreatmentEvidence,
      { treatmentId },
    );
    expect(evidence.baseline?.assessmentId).toBe(baselineId);
    expect(evidence.baseline?.status).toBe("accepted");
  });

  test("rejects linking assessments from another object", async () => {
    const { t, authed, organizationId, userId, collectionId } =
      await setupConservationWithAssessments();

    const otherCollectionId = await t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "B-2",
        title: "Other vase",
        condition: "Good",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const foreignAssessment = await authed.mutation(
      api.conditionAssessments.create,
      {
        collectionId: otherCollectionId,
        assessedAt: Date.UTC(2026, 8, 1),
        condition: "Good",
        summary: "Other object",
        observations: [
          { area: "Body", description: "Fine", severity: "minor" },
        ],
        photos: [],
      },
    );

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "cleaning",
      title: "Clean",
      description: "Clean object",
    });

    await expect(
      authed.mutation(api.conservationTreatments.linkBaselineAssessment, {
        treatmentId,
        assessmentId: foreignAssessment,
      }),
    ).rejects.toThrow(/object/i);
  });

  test("follow-up status can be recorded after completion", async () => {
    const { authed, collectionId } = await setupConservationWithAssessments();

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "restoration",
      title: "Inpainting",
      description: "Retouch losses",
    });
    await authed.mutation(api.conservationTreatments.approve, { treatmentId });
    await authed.mutation(api.conservationTreatments.startProgress, {
      treatmentId,
    });

    const outcomeId = await createAcceptedOutcome(
      authed,
      collectionId,
      "Excellent",
    );
    await authed.mutation(api.conservationTreatments.linkOutcomeAssessment, {
      treatmentId,
      assessmentId: outcomeId,
    });
    await authed.mutation(api.conservationTreatments.complete, {
      treatmentId,
    });

    await authed.mutation(api.conservationTreatments.setFollowUp, {
      treatmentId,
      status: "pending",
      notes: "Recheck in six months",
      dueAt: Date.UTC(2027, 2, 1),
    });

    const evidence = await authed.query(
      api.conservationTreatments.getTreatmentEvidence,
      { treatmentId },
    );
    expect(evidence.followUp).toMatchObject({
      status: "pending",
      notes: "Recheck in six months",
    });
  });
});
