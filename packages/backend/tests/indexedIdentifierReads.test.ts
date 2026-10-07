import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import * as accessions from "../convex/accessions";
import * as assignments from "../convex/assignments";
import * as collections from "../convex/collections";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

// Records created since the preserved identifier policy carry a
// normalizedIdentifier; every read that returns the stored document must
// accept it.
test("object and accession reads accept records with a normalized identifier", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, [
    "collections.read",
    "collections.create",
    "collections.update",
  ]);
  const user = authedForUser(t, setup.userId);
  const collectionId = await user.mutation(api.collections.create, {
    organizationId: setup.organizationId,
    accessionNumber: "NORM-1",
    title: "Indexed object",
  });
  const accessionId = await user.mutation(api.accessions.create, {
    organizationId: setup.organizationId,
    accessionNumber: "NORM-ACC-1",
    dateReceived: Date.now(),
    source: "Donor",
    method: "gift",
  });
  const stored = await t.run(async (ctx) => ({
    collection: await ctx.db.get(collectionId),
    accession: await ctx.db.get(accessionId),
  }));
  expect(stored.collection?.normalizedIdentifier).toBe("norm-1");
  expect(stored.accession?.normalizedIdentifier).toBe("norm-acc-1");

  expectMatchesReturns(
    collections.get,
    await user.query(api.collections.get, { collectionId }),
  );
  expectMatchesReturns(
    collections.getObjectDetail,
    await user.query(api.collections.getObjectDetail, { collectionId }),
  );
  expectMatchesReturns(
    collections.bulkExport,
    await user.query(api.collections.bulkExport, {
      collectionIds: [collectionId],
    }),
  );
  expectMatchesReturns(
    accessions.get,
    await user.query(api.accessions.get, { accessionId }),
  );
  expectMatchesReturns(
    assignments.listMyAssignments,
    await user.query(api.assignments.listMyAssignments, {
      organizationId: setup.organizationId,
    }),
  );
});
