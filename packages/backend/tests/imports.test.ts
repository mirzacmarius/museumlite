import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

test("should process import batch", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    {
      organizationName: "Import Test Museum",
      slugPrefix: "import-test",
      userEmailPrefix: "import-user",
      userName: "Import Test User",
      roleName: "Import Manager",
      subscriptionTier: "pro",
    },
  );
  const authed = authedForUser(t, userId);

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    totalItems: 1,
  });

  const result = await authed.mutation(api.imports.importAccessionsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        accessionNumber: "IMP-001",
        dateReceived: "2024-01-15",
        source: "Donor",
        method: "gift",
        cost: "$1,250.50",
        notes: "Imported row",
      },
    ],
  });

  expect(result).toMatchObject({ processed: 1, errors: [] });

  const accessions = await t.run(async (ctx) => {
    return await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();
  });

  expect(accessions).toHaveLength(1);
  expect(accessions[0]?.method).toBe("gift");
  expect(accessions[0]?.cost).toBe(1250.5);
});

test("should handle import errors gracefully", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    {
      organizationName: "Import Test Museum",
      slugPrefix: "import-test",
      userEmailPrefix: "import-user",
      userName: "Import Test User",
      roleName: "Import Manager",
      subscriptionTier: "pro",
    },
  );
  const authed = authedForUser(t, userId);

  const validation = await authed.mutation(
    api.importValidation.validateAccessionImport,
    {
      organizationId,
      rows: [
        {
          accessionNumber: "BAD-DATE",
          dateReceived: "not-a-date",
          source: "Donor",
          method: "gift",
        },
      ],
    },
  );

  expect(validation.isValid).toBe(false);
  expect(validation.errors).toContainEqual(
    expect.objectContaining({
      field: "dateReceived",
      message: "Invalid date format. Use YYYY-MM-DD",
      severity: "error",
    }),
  );

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    totalItems: 1,
  });

  const result = await authed.mutation(api.imports.importAccessionsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        accessionNumber: "BAD-DATE",
        dateReceived: "not-a-date",
        source: "Donor",
        method: "gift",
      },
    ],
  });

  expect(result.processed).toBe(0);
  expect(result.errors).toEqual(["Row 2: Invalid date format. Use YYYY-MM-DD"]);

  const accessions = await t.run(async (ctx) => {
    return await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();
  });

  expect(accessions).toHaveLength(0);
});

test("should import warning-only accession rows with normalized values", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    {
      organizationName: "Import Test Museum",
      slugPrefix: "import-test",
      userEmailPrefix: "import-user",
      userName: "Import Test User",
      roleName: "Import Manager",
      subscriptionTier: "pro",
    },
  );
  const authed = authedForUser(t, userId);

  const validation = await authed.mutation(
    api.importValidation.validateAccessionImport,
    {
      organizationId,
      rows: [
        {
          accessionNumber: "WARN-METHOD",
          dateReceived: "2024-01-15",
          source: "Donor",
          method: "unexpected acquisition method",
        },
      ],
    },
  );

  expect(validation.isValid).toBe(true);
  expect(validation.warningCount).toBe(1);

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    totalItems: 1,
  });

  const result = await authed.mutation(api.imports.importAccessionsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        accessionNumber: "WARN-METHOD",
        dateReceived: "2024-01-15",
        source: "Donor",
        method: "unexpected acquisition method",
      },
    ],
  });

  expect(result).toMatchObject({ processed: 1, errors: [] });

  const accessions = await t.run(async (ctx) => {
    return await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();
  });

  expect(accessions).toHaveLength(1);
  expect(accessions[0]?.method).toBe("other");
});

test("should track import progress", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    {
      organizationName: "Import Test Museum",
      slugPrefix: "import-progress",
      subscriptionTier: "pro",
    },
  );
  const authed = authedForUser(t, userId);

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    totalItems: 2,
  });

  await authed.mutation(api.imports.importAccessionsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        accessionNumber: "PROG-001",
        dateReceived: "2024-01-15",
        source: "Donor",
        method: "gift",
      },
    ],
  });

  const job = await authed.query(api.imports.getImportJob, { jobId });

  expect(job).not.toBeNull();
  expect(job?.processedItems).toBe(1);
  expect(job?.progress).toBeGreaterThan(0);
});

test("cancelling an import stops further rows", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    {
      organizationName: "Import Test Museum",
      slugPrefix: "import-cancel",
      subscriptionTier: "pro",
    },
  );
  const authed = authedForUser(t, userId);

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    totalItems: 1,
  });

  await authed.mutation(api.imports.cancelImportJob, { jobId });

  const job = await authed.query(api.imports.getImportJob, { jobId });
  expect(job?.status).toBe("cancelled");
});

test("getImportTemplate returns PastPerfect template", async () => {
  const t = createConvexTest();

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });
  });

  const authed = authedForUser(t, userId);
  const template = await authed.query(api.imports.getImportTemplate, {
    templateName: "PastPerfect",
  });

  expect(template).not.toBeNull();
  expect(template?.name).toBe("PastPerfect");
  expect(template?.system).toBe("PastPerfect");
  expect(template?.collectionMappings).toBeDefined();
  expect(template?.accessionMappings).toBeDefined();
  expect(template?.collectionMappings.length).toBeGreaterThan(0);
  expect(template?.accessionMappings.length).toBeGreaterThan(0);
});

test("getImportTemplate returns TMS template", async () => {
  const t = createConvexTest();

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });
  });

  const authed = authedForUser(t, userId);
  const template = await authed.query(api.imports.getImportTemplate, {
    templateName: "TMS",
  });

  expect(template).not.toBeNull();
  expect(template?.name).toBe("TMS");
  expect(template?.system).toBe("TMS");
  expect(template?.collectionMappings).toBeDefined();
  expect(template?.accessionMappings).toBeDefined();
  expect(template?.collectionMappings.length).toBeGreaterThan(0);
  expect(template?.accessionMappings.length).toBeGreaterThan(0);
});

test("listImportTemplates returns both PastPerfect and TMS templates", async () => {
  const t = createConvexTest();

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      name: "Test User",
    });
  });

  const authed = authedForUser(t, userId);
  const templates = await authed.query(api.imports.listImportTemplates, {});

  expect(templates).toBeDefined();
  expect(templates.length).toBe(2);

  const templateNames = templates.map((t) => t.name);
  expect(templateNames).toContain("PastPerfect");
  expect(templateNames).toContain("TMS");
});

test("object CSVs carry the date made, and a re-import keeps the structured date, BC included, while EDTF that isn't fails its row", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read"],
    { subscriptionTier: "pro" },
  );
  const authed = authedForUser(t, userId);
  await authed.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "E-1",
    title: "Coin",
    dateCreated: "Roman Republic",
    dateCreatedEdtf: "-0499~",
  });
  await authed.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "E-2",
    title: "Jug",
    dateCreated: "c. 1850",
  });

  // Settings > Data: the stored value only, so a re-import adds no reading.
  const rows = await authed.mutation(api.imports.exportObjects, {
    organizationId,
  });
  const exported = new Map(rows.map((row) => [row.accessionNumber, row]));
  expect(exported.get("E-1")?.dateCreatedEdtf).toBe("-0499~");
  expect(exported.get("E-2")?.dateCreatedEdtf).toBeUndefined();
  const template = await authed.query(api.imports.getImportTemplateByType, {
    type: "objects",
  });
  const edtfColumn = template.headers.indexOf("dateCreatedEdtf");
  expect(edtfColumn).toBe(template.headers.indexOf("dateCreated") + 1);
  expect(template.exampleRow).toHaveLength(template.headers.length);

  // The catalog page's file adds the EDTF in effect and its years.
  const csv = await authed.mutation(api.imports.exportObjectsWithFormat, {
    organizationId,
    format: "csv",
  });
  const [header = "", ...lines] = csv.split("\n");
  expect(header).toContain(
    "dateCreated,dateCreatedEdtf,productionDateEdtf,productionEarliestYear,productionLatestYear,",
  );
  const line = (number: string) =>
    lines.find((candidate) => candidate.startsWith(`"${number}"`)) ?? "";
  expect(line("E-1")).toContain(
    `"Roman Republic","'-0499~","'-0499~",-504,-494,`,
  );
  expect(line("E-2")).toContain(`"c. 1850","","1850~",1845,1855,`);
  const json = JSON.parse(
    await authed.mutation(api.imports.exportObjectsWithFormat, {
      organizationId,
      format: "json",
    }),
  ) as Array<Record<string, unknown>>;
  expect(json.find((row) => row.accessionNumber === "E-2")).toMatchObject({
    productionDateEdtf: "1850~",
    productionEarliestYear: 1845,
    productionLatestYear: 1855,
  });

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    entityType: "objects",
    totalItems: 3,
  });
  const imported = await authed.mutation(api.imports.importObjectsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        rowNumber: 2,
        accessionNumber: "I-1",
        title: "Coin",
        dateCreated: "Roman Republic",
        dateCreatedEdtf: "'-0499~",
      },
      {
        rowNumber: 3,
        accessionNumber: "I-2",
        title: "Bowl",
        dateCreatedEdtf: "1850s",
      },
      {
        rowNumber: 4,
        accessionNumber: "I-3",
        title: "Jar",
        dateCreatedEdtf: " 185X ",
      },
    ],
  });
  expect(imported.results).toMatchObject([
    { status: "accepted" },
    { status: "failed" },
    { status: "accepted" },
  ]);
  expect(imported.errors).toEqual([
    "Row 3: dateCreatedEdtf must be an EDTF date MuseumLite reads, such as 1850, 1850~, 185X or 1848/1852, without seasons or times, and an interval cannot end before it starts",
  ]);
  const stored = await t.run((ctx) =>
    ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  );
  const byNumber = new Map(stored.map((row) => [row.accessionNumber, row]));
  expect(byNumber.get("I-1")?.dateCreatedEdtf).toBe("-0499~");
  expect(byNumber.get("I-3")?.dateCreatedEdtf).toBe("185X");
  expect(byNumber.has("I-2")).toBe(false);
});
