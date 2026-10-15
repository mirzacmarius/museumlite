import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as conservationTreatments from "../convex/conservationTreatments";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
} from "./testHarness";

type TreatmentType = "cleaning" | "repair" | "assessment";
type TreatmentStatus = "proposed" | "completed";

async function setupConservation(
  t: ConvexTest,
  subscriptionTier: "free" | "pro" = "pro",
) {
  return createOrgUserCollectionWithPermissions(t, ["collections.read"], {
    subscriptionTier,
  });
}

async function insertTreatments(
  t: ConvexTest,
  setup: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    collectionId: Id<"collections">;
  },
  rows: Array<{
    treatmentType: TreatmentType;
    count: number;
    title: string;
    status?: TreatmentStatus;
  }>,
) {
  await t.run(async (ctx) => {
    for (const row of rows) {
      for (let index = 0; index < row.count; index += 1) {
        await ctx.db.insert("conservationTreatments", {
          organizationId: setup.organizationId,
          collectionId: setup.collectionId,
          treatmentType: row.treatmentType,
          title: `${row.title} ${index}`,
          description: "Recorded treatment",
          performedBy: setup.userId,
          performedAt: Date.UTC(2026, 0, 1) + index * 1000,
          status: row.status,
        });
      }
    }
  });
}

async function listAll(
  caller: ReturnType<typeof authedForUser>,
  args: {
    organizationId: Id<"organizations">;
    treatmentType?: TreatmentType;
    status?: TreatmentStatus;
    search?: string;
  },
) {
  const titles: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const result: Awaited<
      ReturnType<
        typeof caller.query<typeof api.conservationTreatments.listPage>
      >
    > = await caller.query(api.conservationTreatments.listPage, {
      ...args,
      paginationOpts: { cursor, numItems: 20 },
    });
    expectMatchesReturns(conservationTreatments.listPage, result);
    titles.push(...result.page.map((row) => row.title));
    if (result.isDone) return titles;
    cursor = result.continueCursor;
  }
}

test("filtered pages list every treatment of a type, newest first, and the totals match what is listed", async () => {
  const t = createConvexTest();
  const setup = await setupConservation(t);
  await insertTreatments(t, setup, [
    { treatmentType: "cleaning", count: 30, title: "Surface clean" },
    { treatmentType: "repair", count: 5, title: "Joint repair" },
  ]);
  const user = authedForUser(t, setup.userId);

  const cleaning = await listAll(user, {
    organizationId: setup.organizationId,
    treatmentType: "cleaning",
  });
  const everything = await listAll(user, {
    organizationId: setup.organizationId,
  });
  const counts = await user.query(api.conservationTreatments.getListCounts, {
    organizationId: setup.organizationId,
  });

  expectMatchesReturns(conservationTreatments.getListCounts, counts);
  expect(cleaning).toHaveLength(30);
  expect(cleaning[0]).toBe("Surface clean 29");
  expect(new Set(cleaning).size).toBe(30);
  expect(everything).toHaveLength(35);
  expect(counts.total).toBe(everything.length);
  expect(counts.byType).toEqual([
    { treatmentType: "cleaning", count: cleaning.length },
    { treatmentType: "repair", count: 5 },
  ]);
});

test("a status filter lists and counts only treatments in that status", async () => {
  const t = createConvexTest();
  const setup = await setupConservation(t);
  await insertTreatments(t, setup, [
    {
      treatmentType: "cleaning",
      count: 2,
      title: "Proposed clean",
      status: "proposed",
    },
    {
      treatmentType: "repair",
      count: 1,
      title: "Proposed repair",
      status: "proposed",
    },
    {
      treatmentType: "cleaning",
      count: 3,
      title: "Finished clean",
      status: "completed",
    },
  ]);
  const user = authedForUser(t, setup.userId);

  const proposed = await listAll(user, {
    organizationId: setup.organizationId,
    status: "proposed",
  });
  const proposedCleaning = await listAll(user, {
    organizationId: setup.organizationId,
    status: "proposed",
    treatmentType: "cleaning",
  });
  const counts = await user.query(api.conservationTreatments.getListCounts, {
    organizationId: setup.organizationId,
    status: "proposed",
  });

  expect(proposed).toEqual([
    "Proposed repair 0",
    "Proposed clean 1",
    "Proposed clean 0",
  ]);
  expect(proposedCleaning).toEqual(["Proposed clean 1", "Proposed clean 0"]);
  expect(counts).toEqual({
    total: 3,
    byType: [
      { treatmentType: "cleaning", count: 2 },
      { treatmentType: "repair", count: 1 },
    ],
  });
});

test("search matches treatment titles within the selected type", async () => {
  const t = createConvexTest();
  const setup = await setupConservation(t);
  await insertTreatments(t, setup, [
    { treatmentType: "cleaning", count: 2, title: "Varnish removal" },
    { treatmentType: "repair", count: 1, title: "Varnish consolidation" },
    { treatmentType: "repair", count: 1, title: "Frame repair" },
  ]);
  const user = authedForUser(t, setup.userId);

  const anyType = await listAll(user, {
    organizationId: setup.organizationId,
    search: "varnish",
  });
  const repairsOnly = await listAll(user, {
    organizationId: setup.organizationId,
    treatmentType: "repair",
    search: "varnish",
  });

  expect(anyType.toSorted()).toEqual([
    "Varnish consolidation 0",
    "Varnish removal 0",
    "Varnish removal 1",
  ]);
  expect(repairsOnly).toEqual(["Varnish consolidation 0"]);
});

test("search also matches the object and the performer, across pages that hold no match", async () => {
  const t = createConvexTest();
  const setup = await setupConservation(t);
  await t.run(async (ctx) => {
    const collectionId = await ctx.db.insert("collections", {
      organizationId: setup.organizationId,
      accessionNumber: "OBJ-FJORD",
      title: "Fjordheim tapestry",
      status: "active",
      catalogedBy: setup.userId,
      catalogedAt: Date.UTC(2025, 0, 1),
    });
    await ctx.db.insert("conservationTreatments", {
      organizationId: setup.organizationId,
      collectionId,
      treatmentType: "repair",
      title: "Joint repair",
      description: "Recorded treatment",
      performedBy: setup.userId,
      performedByName: "Ingrid Solberg",
      performedAt: Date.UTC(2025, 0, 1),
    });
  });
  await insertTreatments(t, setup, [
    { treatmentType: "cleaning", count: 30, title: "Surface clean" },
  ]);
  const user = authedForUser(t, setup.userId);

  expect(
    await listAll(user, {
      organizationId: setup.organizationId,
      search: "fjordheim",
    }),
  ).toEqual(["Joint repair"]);
  expect(
    await listAll(user, {
      organizationId: setup.organizationId,
      search: "ingrid",
    }),
  ).toEqual(["Joint repair"]);
});

test("treatment lists stay within the caller's organization and plan", async () => {
  const t = createConvexTest();
  const owner = await setupConservation(t);
  const outsider = await setupConservation(t);
  const freePlan = await setupConservation(t, "free");
  await insertTreatments(t, owner, [
    { treatmentType: "cleaning", count: 1, title: "Private clean" },
  ]);

  for (const [caller, organizationId] of [
    [authedForUser(t, outsider.userId), owner.organizationId],
    [authedForUser(t, freePlan.userId), freePlan.organizationId],
  ] as const) {
    await expect(
      caller.query(api.conservationTreatments.listPage, {
        organizationId,
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow();
    await expect(
      caller.query(api.conservationTreatments.getListCounts, {
        organizationId,
      }),
    ).rejects.toThrow();
  }
  expect(
    await listAll(authedForUser(t, outsider.userId), {
      organizationId: outsider.organizationId,
    }),
  ).toEqual([]);
});
