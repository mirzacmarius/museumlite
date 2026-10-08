import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

// Approved seams: authenticated public Convex catalog/accession/import/review APIs.
async function setup() {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read", "collections.update"],
    { subscriptionTier: "pro" },
  );
  return {
    t,
    organizationId,
    userId,
    roleId,
    client: authedForUser(t, userId),
  };
}

test("catalog rejects an identifier equivalent to a historical number while preserving the original", async () => {
  const { t, organizationId, userId, client } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: " Historic-A01 ",
      title: "Historical object",
      status: "archived",
      catalogedBy: userId,
      catalogedAt: 1,
    }),
  );
  await expect(
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "historic-a01",
      title: "Another object",
    }),
  ).rejects.toThrow(/identifier.*already.*catalog/i);
  const original = await client.query(api.collections.getByAccessionNumber, {
    organizationId,
    accessionNumber: " Historic-A01 ",
  });
  expect(original?.accessionNumber).toBe(" Historic-A01 ");
});

test("accession numbers are unique within their register and can reuse a catalog number", async () => {
  const { t, organizationId, roleId, client } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Review" }],
      canInitiateRoles: [roleId],
    }),
  );
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "M-101",
    title: "Catalog record",
  });
  await client.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "M-101",
    dateReceived: 1,
    source: "Donor",
    method: "gift",
  });
  await expect(
    client.mutation(api.accessions.create, {
      organizationId,
      accessionNumber: "m-101",
      dateReceived: 2,
      source: "Donor",
      method: "gift",
    }),
  ).rejects.toThrow(/identifier.*already.*accession/i);
});

test("one accession import batch rejects equivalent identifiers and exposes a correctable row error", async () => {
  const { organizationId, client } = await setup();
  const jobId = await client.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    totalItems: 2,
  });
  const result = await client.mutation(api.imports.importAccessionsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        accessionNumber: " Import-A ",
        dateReceived: "2024-01-01",
        source: "Donor",
        method: "gift",
      },
      {
        accessionNumber: "import-a",
        dateReceived: "2024-01-01",
        source: "Donor",
        method: "gift",
      },
    ],
  });
  expect(result.processed).toBe(1);
  expect(result.errors).toEqual([
    expect.stringMatching(/Row 3:.*already.*accession/),
  ]);
});

test("identifier review indexes legacy conflicts without changing permanent strings and can be rerun", async () => {
  const { t, organizationId, userId, client } = await setup();
  for (const accessionNumber of ["Old-01", " old-01 ", "Other-20"])
    await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber,
        title: accessionNumber,
        status: "archived",
        catalogedBy: userId,
        catalogedAt: 1,
      }),
    );
  await client.mutation(api.identifiers.indexLegacyBatch, {
    organizationId,
    register: "catalog",
  });
  const repeated = await client.mutation(api.identifiers.indexLegacyBatch, {
    organizationId,
    register: "catalog",
  });
  expect(repeated.processed).toBe(0);
  const conflicts = await client.query(api.identifiers.listConflicts, {
    organizationId,
    register: "catalog",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(conflicts.page.map((row) => row.identifier)).toEqual([
    "Old-01",
    " old-01 ",
  ]);
  expect(conflicts.page[0]?.matches.map((row) => row.identifier)).toEqual([
    "Old-01",
    " old-01 ",
  ]);
  await client.mutation(api.identifiers.reviewConflict, {
    organizationId,
    register: "catalog",
    recordId: conflicts.page[0]!._id,
    note: "Both historical register entries verified; preserved as recorded.",
  });
  const reviewed = await client.query(api.identifiers.listConflicts, {
    organizationId,
    register: "catalog",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(reviewed.page[0]?.review?.note).toBe(
    "Both historical register entries verified; preserved as recorded.",
  );
  await expect(
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "OLD-01",
      title: "Third record",
    }),
  ).rejects.toThrow(/already.*catalog/);
});

test("normalized identifier search returns actual prefix matches instead of lexically later numbers", async () => {
  const { organizationId, client } = await setup();
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "M-101",
    title: "Vase",
  });
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "Z-999",
    title: "Cup",
  });
  const result = await client.query(api.search.globalSearch, {
    organizationId,
    query: " m-10 ",
  });
  expect(result.objects.map((row) => row.accessionNumber)).toEqual(["M-101"]);
  const missing = await client.query(api.search.globalSearch, {
    organizationId,
    query: "Q-888",
  });
  expect(missing.objects).toEqual([]);
});

test("saving a historical draft preserves its exact number even when another historical entry conflicts", async () => {
  const { t, organizationId, client } = await setup();
  const first = await t.run((ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: " OLD-DRAFT ",
      dateReceived: 1,
      source: "Historical source",
      method: "gift",
      status: "pending",
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "old-draft",
      dateReceived: 1,
      source: "Other historical source",
      method: "gift",
      status: "pending",
    }),
  );
  await client.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    accessionId: first,
    saveMode: "draft",
    objectData: { accessionNumber: " OLD-DRAFT ", title: "Updated title" },
  });
  const result = await client.query(api.accessions.get, { accessionId: first });
  expect(result?.accessionNumber).toBe(" OLD-DRAFT ");
});

test("concurrent new catalog assignments admit one winner and leave the other correctable", async () => {
  const { organizationId, client } = await setup();
  const results = await Promise.allSettled([
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "SAME-01",
      title: "First",
    }),
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: " same-01 ",
      title: "Second",
    }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  const corrected = await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "SAME-02",
    title: "Corrected",
  });
  expect(
    (
      await client.query(api.collections.getByAccessionNumber, {
        organizationId,
        accessionNumber: "SAME-02",
      })
    )?._id,
  ).toBe(corrected);
});

test("inspection and review are tenant-scoped and require collection permissions", async () => {
  const { t, organizationId, client } = await setup();
  const other = await createOrgUserWithPermissions(t, ["collections.read"]);
  await expect(
    client.query(api.identifiers.inspect, {
      organizationId: other.organizationId,
      register: "catalog",
      identifier: "PRIVATE",
    }),
  ).rejects.toThrow(/permission|member/i);
  const readOnly = authedForUser(t, other.userId);
  await expect(
    readOnly.mutation(api.identifiers.indexLegacyBatch, {
      organizationId: other.organizationId,
      register: "catalog",
    }),
  ).rejects.toThrow(/permission/i);
  await expect(
    t.query(api.identifiers.inspect, {
      organizationId,
      register: "catalog",
      identifier: "PRIVATE",
    }),
  ).rejects.toThrow(/permission/i);
});

test("new assignments fail closed until a large legacy register has been indexed", async () => {
  const { t, organizationId, userId, client } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 101; i++)
      await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `OLD-${i}`,
        title: "Historical",
        status: "archived",
        catalogedBy: userId,
        catalogedAt: 1,
      });
  });
  await expect(
    client.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "NEW-01",
      title: "New",
    }),
  ).rejects.toThrow(/complete.*identifier index/);
  let hasMore = true;
  while (hasMore)
    hasMore = (
      await client.mutation(api.identifiers.indexLegacyBatch, {
        organizationId,
        register: "catalog",
      })
    ).hasMore;
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "NEW-01",
    title: "New",
  });
  expect(
    (
      await client.query(api.collections.getByAccessionNumber, {
        organizationId,
        accessionNumber: "NEW-01",
      })
    )?.title,
  ).toBe("New");
});

test("draft requests with occupied numbers fail explicitly without guessing identity or renumbering", async () => {
  const { organizationId, client } = await setup();
  const accessionId = await client.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: { accessionNumber: "DRAFT-01", title: "First draft" },
  });
  await expect(
    client.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      saveMode: "draft",
      objectData: { accessionNumber: "DRAFT-01", title: "Second draft" },
    }),
  ).rejects.toThrow(/already.*accession/);
  expect(
    (await client.query(api.accessions.get, { accessionId }))?.draftObjectData
      ?.title,
  ).toBe("First draft");
});

test("configured numbering skips occupied numbers and does not invent a different format", async () => {
  const { t, organizationId, client } = await setup();
  await t.run((ctx) =>
    ctx.db.patch(organizationId, {
      settings: {
        autoGenerateAccessionNumbers: true,
        accessionNumberFormat: "OBJ-{####}",
        accessionCounterScope: "global",
      },
    }),
  );
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "OBJ-0001",
    title: "Existing",
  });
  const next = await client.mutation(api.collections.create, {
    organizationId,
    title: "Generated",
  });
  expect(
    (
      await client.query(api.collections.getByAccessionNumber, {
        organizationId,
        accessionNumber: "OBJ-0002",
      })
    )?._id,
  ).toBe(next);
  await t.run((ctx) =>
    ctx.db.patch(organizationId, {
      settings: {
        autoGenerateAccessionNumbers: true,
        accessionNumberFormat: "OBJ-0001",
        accessionCounterScope: "global",
      },
    }),
  );
  await expect(
    client.mutation(api.collections.create, {
      organizationId,
      title: "Invalid configured generator",
    }),
  ).rejects.toThrow(/25 occupied.*catalog/);
});

test("an existing accession identifier cannot be silently replaced during draft editing", async () => {
  const { organizationId, client } = await setup();
  const accessionId = await client.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: { accessionNumber: "PERMANENT-01", title: "Original draft" },
  });
  await expect(
    client.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "draft",
      objectData: { accessionNumber: "REPLACEMENT-02", title: "Edited draft" },
    }),
  ).rejects.toThrow(/permanent.*identifier|identifier.*permanent/i);
  expect(
    (await client.query(api.accessions.get, { accessionId }))?.accessionNumber,
  ).toBe("PERMANENT-01");
});

test("pending accession can select a separate catalog number to recover cross-register reuse without renumbering", async () => {
  const { t, organizationId, roleId, client } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId, name: "Review" }],
      canInitiateRoles: [roleId],
    }),
  );
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "ACC-01",
    title: "Historic catalog record",
  });
  const accessionId = await client.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: { accessionNumber: "ACC-01", title: "New object" },
  });
  await client.mutation(api.identifiers.assignCatalogIdentifier, {
    accessionId,
    identifier: "CAT-02",
  });
  expect(
    (await client.query(api.accessions.get, { accessionId }))?.accessionNumber,
  ).toBe("ACC-01");
  await t.run((ctx) =>
    ctx.db.patch(organizationId, {
      settings: { accessionWorkflowEnabled: false },
    }),
  );
  await client.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    accessionId,
    saveMode: "submit",
    objectData: { accessionNumber: "ACC-01", title: "New object" },
  });
  const collection = await client.query(api.collections.getByAccessionNumber, {
    organizationId,
    accessionNumber: "CAT-02",
  });
  expect(collection?.title).toBe("New object");
  expect(
    (await client.query(api.accessions.get, { accessionId }))?.accessionNumber,
  ).toBe("ACC-01");
  await expect(
    client.mutation(api.identifiers.assignCatalogIdentifier, {
      accessionId,
      identifier: "CAT-03",
    }),
  ).rejects.toThrow(/permanent|pending|published/);
});

test("direct accession creation without an approval workflow publishes with an explicit separate catalog number", async () => {
  const { organizationId, client } = await setup();
  await client.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "DIRECT-01",
    title: "Existing catalog record",
  });
  const accessionId = await client.mutation(api.accessions.create, {
    organizationId,
    accessionNumber: "DIRECT-01",
    catalogIdentifier: "DIRECT-CAT-02",
    dateReceived: 1,
    source: "Donor",
    method: "gift",
  });
  const accession = await client.query(api.accessions.get, { accessionId });
  const catalog = await client.query(api.collections.getByAccessionNumber, {
    organizationId,
    accessionNumber: "DIRECT-CAT-02",
  });
  expect(accession?.accessionNumber).toBe("DIRECT-01");
  expect(accession?.collectionId).toBe(catalog?._id);
  expect(catalog?.accessionNumber).toBe("DIRECT-CAT-02");
});
