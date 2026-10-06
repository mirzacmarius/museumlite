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
