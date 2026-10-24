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

test("object CSVs carry the description and rights as entered, and a re-import reads codes, URIs and lists, while a value it cannot read fails its row", async () => {
  const inCopyright = "http://rightsstatements.org/vocab/InC/1.0/";
  const cc0 = "https://creativecommons.org/publicdomain/zero/1.0/";
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read"],
    { subscriptionTier: "pro" },
  );
  await t.run((ctx) =>
    ctx.db.patch(organizationId, {
      settings: { rightsDefaults: { objectRightsStatement: inCopyright } },
    }),
  );
  const authed = authedForUser(t, userId);
  await authed.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "D-1",
    title: "Tea set",
    numberOfObjects: 12,
    subjects: ["Willow pattern", "Bridge"],
    completeness: "incomplete",
    completenessNote: "One cup missing",
    dimensionMeasuredPart: "overall",
    measurementSets: [{ part: "base", diameter: 12, unit: "cm" }],
    rightsStatement: cc0,
  });
  await authed.mutation(api.collections.create, {
    organizationId,
    accessionNumber: "D-2",
    title: "Cup",
  });

  // Settings > Data: entered values only, never the default in effect.
  const rows = await authed.mutation(api.imports.exportObjects, {
    organizationId,
  });
  const exported = new Map(rows.map((row) => [row.accessionNumber, row]));
  const teaSet = exported.get("D-1");
  expect(teaSet).toMatchObject({
    numberOfObjects: 12,
    subjects: "Willow pattern; Bridge",
    completeness: "incomplete",
    completenessNote: "One cup missing",
    dimensionMeasuredPart: "overall",
    rightsStatement: cc0,
  });
  expect(JSON.parse(teaSet?.measurementSets ?? "")).toEqual([
    { part: "base", diameter: 12, unit: "cm" },
  ]);
  expect(exported.get("D-2")?.rightsStatement).toBeUndefined();
  const template = await authed.query(api.imports.getImportTemplateByType, {
    type: "objects",
  });
  expect(template.headers).toEqual(
    expect.arrayContaining([
      "numberOfObjects",
      "subjects",
      "completeness",
      "completenessNote",
      "dimensionMeasuredPart",
      "measurementSets",
      "rightsStatement",
    ]),
  );
  expect(template.headers).not.toContain("rightsStatementInEffect");
  expect(template.exampleRow).toHaveLength(template.headers.length);

  // The catalog page's files add the statement in effect.
  const csv = await authed.mutation(api.imports.exportObjectsWithFormat, {
    organizationId,
    format: "csv",
  });
  const [header = "", ...lines] = csv.split("\n");
  expect(header).toContain(
    "dimensions,dimensionMeasuredPart,measurementSets,numberOfObjects,description,subjects,condition,completeness,completenessNote,provenance,rightsStatement,rightsStatementInEffect,",
  );
  const line = (number: string) =>
    lines.find((candidate) => candidate.startsWith(`"${number}"`)) ?? "";
  expect(line("D-1")).toContain(
    `"overall","[{""diameter"":12,""part"":""base"",""unit"":""cm""}]",12,"","Willow pattern; Bridge","","incomplete","One cup missing","","${cc0}","${cc0}",`,
  );
  expect(line("D-2")).toContain(`,"","${inCopyright}",`);
  const json = JSON.parse(
    await authed.mutation(api.imports.exportObjectsWithFormat, {
      organizationId,
      format: "json",
    }),
  ) as Array<Record<string, unknown>>;
  expect(json.find((row) => row.accessionNumber === "D-2")).toMatchObject({
    rightsStatementInEffect: inCopyright,
  });
  expect(json.find((row) => row.accessionNumber === "D-1")).toMatchObject({
    subjects: ["Willow pattern", "Bridge"],
    rightsStatementInEffect: cc0,
  });
  const dublinCore = await authed.mutation(
    api.imports.exportObjectsWithFormat,
    { organizationId, format: "dublincore" },
  );
  expect(dublinCore).toContain(`<dc:rights>${cc0}</dc:rights>`);
  expect(dublinCore).toContain(`<dc:rights>${inCopyright}</dc:rights>`);
  expect(dublinCore).toContain("<dc:subject>Willow pattern</dc:subject>");
  const spectrum = await authed.mutation(api.imports.exportObjectsWithFormat, {
    organizationId,
    format: "spectrum",
  });
  expect(spectrum).toContain(
    `<rightsStatement>${inCopyright}</rightsStatement>`,
  );
  expect(spectrum).toContain("<numberOfObjects>12</numberOfObjects>");

  const jobId = await authed.mutation(api.imports.createImportJob, {
    organizationId,
    type: "csv",
    entityType: "objects",
    totalItems: 8,
  });
  const imported = await authed.mutation(api.imports.importObjectsBatch, {
    organizationId,
    jobId,
    batchIndex: 0,
    rows: [
      {
        rowNumber: 2,
        accessionNumber: "I-1",
        title: "Net",
        numberOfObjects: " 2 ",
        subjects: "Harbour; harbour;; Pilots",
        completeness: "Fragment",
        completenessNote: " Rim only ",
        dimensionMeasuredPart: "FRAMED",
        measurementSets: '[{"part":"Other","partNote":"Float","diameter":9}]',
        rightsStatement: "CC BY-SA 4.0",
      },
      {
        rowNumber: 3,
        accessionNumber: "I-2",
        title: "A",
        numberOfObjects: "1.5",
      },
      {
        rowNumber: 4,
        accessionNumber: "I-3",
        title: "B",
        completeness: "broken",
      },
      {
        rowNumber: 5,
        accessionNumber: "I-4",
        title: "C",
        measurementSets: '[{"part":"lid","width":1}]',
      },
      {
        rowNumber: 6,
        accessionNumber: "I-5",
        title: "D",
        rightsStatement: "CC BY 3.0",
      },
      {
        rowNumber: 7,
        accessionNumber: "I-6",
        title: "E",
        dimensionMeasuredPart: "lid",
      },
      {
        rowNumber: 8,
        accessionNumber: "I-7",
        title: "F",
        subjects: "a".repeat(201),
      },
      {
        // The Settings export of D-1, read back.
        rowNumber: 9,
        accessionNumber: "I-8",
        title: "Tea set",
        numberOfObjects: String(teaSet?.numberOfObjects),
        subjects: teaSet?.subjects,
        completeness: teaSet?.completeness,
        completenessNote: teaSet?.completenessNote,
        dimensionMeasuredPart: teaSet?.dimensionMeasuredPart,
        measurementSets: teaSet?.measurementSets,
        rightsStatement: teaSet?.rightsStatement,
      },
    ],
  });
  expect(imported.results.map((result) => result.status)).toEqual([
    "accepted",
    "failed",
    "failed",
    "failed",
    "failed",
    "failed",
    "failed",
    "accepted",
  ]);
  expect(imported.errors.map((error) => error.split(":")[0])).toEqual([
    "Row 3",
    "Row 4",
    "Row 5",
    "Row 6",
    "Row 7",
    "Row 8",
  ]);
  expect(imported.errors[3]).toContain("rightsStatement must be");
  const stored = await t.run((ctx) =>
    ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  );
  const byNumber = new Map(stored.map((row) => [row.accessionNumber, row]));
  expect(byNumber.get("I-1")).toMatchObject({
    numberOfObjects: 2,
    subjects: ["Harbour", "Pilots"],
    completeness: "fragment",
    completenessNote: "Rim only",
    dimensionMeasuredPart: "framed",
    measurementSets: [{ part: "other", partNote: "Float", diameter: 9 }],
    rightsStatement: "https://creativecommons.org/licenses/by-sa/4.0/",
  });
  expect(byNumber.get("I-8")).toMatchObject({
    numberOfObjects: 12,
    subjects: ["Willow pattern", "Bridge"],
    completeness: "incomplete",
    completenessNote: "One cup missing",
    dimensionMeasuredPart: "overall",
    measurementSets: [{ part: "base", diameter: 12, unit: "cm" }],
    rightsStatement: cc0,
  });
  for (const failed of ["I-2", "I-3", "I-4", "I-5", "I-6", "I-7"])
    expect(byNumber.has(failed)).toBe(false);
});

test("the objects import reads completeness and measured parts as the labels the app shows in any of its languages", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["collections.create"],
    { subscriptionTier: "pro" },
  );
  const authed = authedForUser(t, userId);
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
        // A Norwegian file.
        rowNumber: 2,
        accessionNumber: "L-1",
        title: "Maleri",
        completeness: "Ufullstendig",
        dimensionMeasuredPart: "med ramme",
        measurementSets: '[{"part":"Uten ramme","height":40}]',
      },
      {
        // A French one.
        rowNumber: 3,
        accessionNumber: "L-2",
        title: "Estampe",
        completeness: "COMPLET",
        dimensionMeasuredPart: "À vue",
      },
      {
        rowNumber: 4,
        accessionNumber: "L-3",
        title: "Vase",
        dimensionMeasuredPart: "Lokk",
      },
    ],
  });

  expect(imported.results.map((result) => result.status)).toEqual([
    "accepted",
    "accepted",
    "failed",
  ]);
  expect(imported.errors[0]).toContain("dimensionMeasuredPart must be one of");
  const stored = await t.run((ctx) =>
    ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  );
  const byNumber = new Map(stored.map((row) => [row.accessionNumber, row]));
  expect(byNumber.get("L-1")).toMatchObject({
    completeness: "incomplete",
    dimensionMeasuredPart: "framed",
    measurementSets: [{ part: "unframed", height: 40 }],
  });
  expect(byNumber.get("L-2")).toMatchObject({
    completeness: "complete",
    dimensionMeasuredPart: "sight",
  });
});
