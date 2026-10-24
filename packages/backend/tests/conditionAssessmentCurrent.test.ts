import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

test("the accepted assessment is read by the Object's pointer, however many later rejections exist", async () => {
  const t = createConvexTest();
  const { userId, organizationId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, [
      "collections.read",
      "collections.update",
      "collections.accept_condition",
    ]);
  const authed = authedForUser(t, userId);

  expect(
    await authed.query(api.conditionAssessments.getCurrentAccepted, {
      collectionId,
    }),
  ).toBeNull();

  const acceptedId = await authed.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Good",
    summary: "Stable",
    observations: [{ area: "Rim", description: "Chip", severity: "minor" }],
    photos: [],
    submit: true,
  });
  await authed.mutation(api.conditionAssessments.accept, {
    assessmentId: acceptedId,
  });
  // Later rejected assessments outnumber any recent-rows window.
  await t.run(async (ctx) => {
    for (let index = 0; index < 12; index++) {
      await ctx.db.insert("conditionAssessments", {
        organizationId,
        collectionId,
        assessedBy: userId,
        assessedAt: Date.UTC(2026, 9, 2 + index),
        recordedAt: Date.UTC(2026, 9, 2 + index),
        condition: "Fair",
        summary: `Rejected draft ${index + 1}`,
        observations: [],
        photos: [],
        status: "rejected",
        rejectedBy: userId,
        rejectedAt: Date.UTC(2026, 9, 2 + index),
        statusChangedAt: Date.UTC(2026, 9, 2 + index),
      });
    }
  });

  expect(
    await authed.query(api.conditionAssessments.getCurrentAccepted, {
      collectionId,
    }),
  ).toEqual({
    assessmentId: acceptedId,
    condition: "Good",
    assessedAt: Date.UTC(2026, 9, 1),
    summary: "Stable",
    observations: [{ area: "Rim", description: "Chip", severity: "minor" }],
  });
});
