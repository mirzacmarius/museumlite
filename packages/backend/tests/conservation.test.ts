import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
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

async function linkAcceptedOutcome(
  authed: ReturnType<typeof authedForUser>,
  collectionId: Id<"collections">,
  treatmentId: Id<"conservationTreatments">,
) {
  const outcomeId = await authed.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Good",
    summary: "Post-treatment check",
    observations: [
      { area: "Surface", description: "Improved", severity: "minor" },
    ],
    photos: [],
  });
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: outcomeId,
  });
  await authed.mutation(api.conservationTreatments.linkOutcomeAssessment, {
    treatmentId,
    assessmentId: outcomeId,
  });
}

async function setupConservationWorkflow(t: ConvexTest) {
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

  return setup;
}

async function getTreatmentStatus(
  t: ConvexTest,
  treatmentId: Id<"conservationTreatments">,
) {
  return await t.run(async (ctx) => {
    const treatment = await ctx.db.get(treatmentId);
    return treatment?.status;
  });
}

describe("Conservation treatment lifecycle", () => {
  test("should create conservation treatment with workflow", async () => {
    const t = createConvexTest();
    const { collectionId, userId } = await setupConservationWorkflow(t);
    const authed = authedForUser(t, userId);

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "restoration",
      title: "Frame restoration",
      description: "Restore damaged frame corners",
    });

    expect(await getTreatmentStatus(t, treatmentId)).toBe("proposed");

    const treatment = await authed.query(api.conservationTreatments.get, {
      id: treatmentId,
    });
    expect(treatment).not.toBeNull();
    expect(treatment?.title).toBe("Frame restoration");
    expect(treatment?.treatmentType).toBe("restoration");
  });

  test("should move treatment through workflow stages", async () => {
    const t = createConvexTest();
    const { collectionId, userId } = await setupConservationWorkflow(t);
    const authed = authedForUser(t, userId);

    const baselineId = await authed.mutation(api.conditionAssessments.create, {
      collectionId,
      assessedAt: Date.UTC(2026, 8, 1),
      condition: "Fair",
      summary: "Pre-treatment baseline",
      observations: [
        { area: "Frame", description: "Wear noted", severity: "minor" },
      ],
      photos: [],
    });
    await authed.mutation(api.conditionAssessments.accept, {
      assessmentId: baselineId,
    });

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "cleaning",
      title: "Surface cleaning",
      description: "Remove surface grime",
    });

    expect(await getTreatmentStatus(t, treatmentId)).toBe("proposed");

    await authed.mutation(api.conservationTreatments.approve, { treatmentId });
    expect(await getTreatmentStatus(t, treatmentId)).toBe("approved");

    await authed.mutation(api.conservationTreatments.startProgress, {
      treatmentId,
    });
    expect(await getTreatmentStatus(t, treatmentId)).toBe("in_progress");

    await linkAcceptedOutcome(authed, collectionId, treatmentId);

    await authed.mutation(api.conservationTreatments.complete, {
      treatmentId,
      notes: "Treatment finished successfully",
    });
    expect(await getTreatmentStatus(t, treatmentId)).toBe("completed");
  });

  test("should add before/after attachments to treatment", async () => {
    const t = createConvexTest();
    const { collectionId, userId } = await setupConservationWorkflow(t);
    const authed = authedForUser(t, userId);

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "assessment",
      title: "Condition assessment",
      description: "Document condition before treatment",
    });

    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(
        new Blob([new Uint8Array([0xff, 0xd8, 0xff])], {
          type: "image/jpeg",
        }),
      );
    });

    await authed.mutation(api.conservationTreatments.addAttachment, {
      treatmentId,
      storageId,
      fileName: "before_photo.jpg",
      fileType: "image/jpeg",
      fileSize: 1024000,
      attachmentType: "before_photo",
      caption: "Condition before treatment",
    });

    const attachments = await authed.query(
      api.conservationTreatments.listAttachments,
      { treatmentId },
    );
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.attachmentType).toBe("before_photo");
    expect(attachments[0]?.fileName).toBe("before_photo.jpg");
  });

  test("should acknowledge and resolve alerts", async () => {
    const t = createConvexTest();
    const { organizationId, collectionId, userId } =
      await setupConservationWorkflow(t);
    const authed = authedForUser(t, userId);

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "repair",
      title: "Canvas repair",
      description: "Repair small tear",
    });

    const alertId = await authed.mutation(api.conservationTreatments.createAlert, {
      organizationId,
      treatmentId,
      alertType: "urgent_treatment",
      title: "Urgent: Water damage detected",
      description: "Water damage found on canvas requires immediate attention",
      priority: "critical",
    });
    expect(alertId).toBeDefined();

    await authed.mutation(api.conservationTreatments.acknowledgeAlert, {
      alertId,
    });
    const acknowledged = await authed.query(
      api.conservationTreatments.listAlerts,
      { organizationId, status: "acknowledged" },
    );
    expect(acknowledged).toHaveLength(1);
    expect(acknowledged[0]?._id).toBe(alertId);

    await authed.mutation(api.conservationTreatments.resolveAlert, {
      alertId,
      resolutionNotes: "Treatment completed successfully",
    });
    const resolved = await authed.query(api.conservationTreatments.listAlerts, {
      organizationId,
      status: "resolved",
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.resolutionNotes).toBe(
      "Treatment completed successfully",
    );
  });

  test("should get active alerts by priority", async () => {
    const t = createConvexTest();
    const { organizationId, collectionId, userId } =
      await setupConservationWorkflow(t);
    const authed = authedForUser(t, userId);

    const treatmentId = await authed.mutation(api.conservationTreatments.create, {
      collectionId,
      treatmentType: "stabilization",
      title: "Climate stabilization",
      description: "Stabilize environmental conditions",
    });

    await Promise.all([
      authed.mutation(api.conservationTreatments.createAlert, {
        organizationId,
        treatmentId,
        alertType: "manual",
        title: "Low priority note",
        description: "Routine follow-up",
        priority: "low",
      }),
      authed.mutation(api.conservationTreatments.createAlert, {
        organizationId,
        treatmentId,
        alertType: "manual",
        title: "Critical issue",
        description: "Immediate attention required",
        priority: "critical",
      }),
      authed.mutation(api.conservationTreatments.createAlert, {
        organizationId,
        treatmentId,
        alertType: "manual",
        title: "High priority issue",
        description: "Schedule treatment soon",
        priority: "high",
      }),
    ]);

    const breakdown = await authed.query(
      api.conservationTreatments.getAlertsByPriority,
      { organizationId },
    );
    expect(breakdown.critical).toBe(1);
    expect(breakdown.high).toBe(1);
    expect(breakdown.low).toBe(1);
    expect(breakdown.total).toBe(3);
  });
});
