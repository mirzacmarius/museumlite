import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

describe("appraisals list pagination", () => {
  test("paginates appraisals by appraisal date", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "collections.read",
      "collections.view_valuation",
    ]);
    const authed = authedForUser(t, userId);

    const collectionId = await t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "OBJ-APPR-001",
        title: "Appraised Object",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          ctx.db.insert("appraisals", {
            organizationId,
            collectionId,
            appraisalDate: Date.now() - index * 86_400_000,
            appraiserName: `Appraiser ${index + 1}`,
            appraisalType: "insurance",
            value: 1_000 + index,
            currency: "USD",
            createdBy: userId,
            createdAt: Date.now(),
          }),
        ),
      );
    });

    const page1 = await authed.query(api.appraisals.list, {
      organizationId,
      paginationOpts: { numItems: 4, cursor: null },
    });

    expect(page1.page).toHaveLength(4);
    expect(page1.isDone).toBe(false);

    const page2 = await authed.query(api.appraisals.list, {
      organizationId,
      paginationOpts: { numItems: 4, cursor: page1.continueCursor },
    });

    expect(page2.page.length).toBeGreaterThan(0);
    expect(page2.isDone).toBe(true);
  });
});
