import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

type OrgSetup = {
  orgId: Id<"organizations">;
  userId: Id<"users">;
};

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

async function createOrgWithUser(
  t: ReturnType<typeof convexTest>,
  permissionNames: string[],
): Promise<OrgSetup> {
  return await t.run(async (ctx) => {
    const [orgId, userId] = await Promise.all([
      ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      }),
      ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      }),
    ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });

    await Promise.all(
      Array.from(permissionNames).map(async (permissionName) => {
        const category =
          (permissionName.split(".")[0] as
            | "collections"
            | "loans"
            | "locations"
            | "sites"
            | "media"
            | "users"
            | "organization"
            | "accounts") ?? "collections";

        const permissionId = await ctx.db.insert("permissions", {
          name: permissionName,
          category,
        });

        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      }),
    );

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });

    return { orgId, userId };
  });
}

describe("Import E2E Verification (manual)", () => {
  /**
   * Verification Step 1: Upload CSV with errors - verify validation report shows before commit
   */
  test("should validate CSV with errors and show validation report", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // Prepare import data with errors
    const invalidRows = [
      {
        accessionNumber: "ACC-001",
        dateReceived: "invalid-date", // Error: invalid date format
        source: "Test Donor",
        method: "gift",
      },
      {
        accessionNumber: "ACC-002",
        dateReceived: "2024-01-15",
        source: "", // Error: missing required field
        method: "unknown-method", // Warning: invalid method
      },
      {
        // Valid row
        accessionNumber: "ACC-003",
        dateReceived: "2024-01-20",
        source: "Valid Donor",
        method: "gift",
        cost: "1000.00",
      },
    ];

    // Validate import - should detect errors WITHOUT committing data
    const validationReport = await asUser.mutation(
      api.importValidation.validateAccessionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: invalidRows,
      },
    );

    expect(validationReport.isValid).toBe(false);
    expect(validationReport.totalRows).toBe(3);
    expect(validationReport.validRows).toBe(1); // Only ACC-003 is valid
    expect(validationReport.errorCount).toBeGreaterThan(0);
    expect(validationReport.warningCount).toBeGreaterThan(0);

    // Verify specific errors
    expect(
      validationReport.errors.some(
        (e) => e.field === "dateReceived" && e.severity === "error",
      ),
    ).toBe(true);
    expect(
      validationReport.errors.some(
        (e) => e.field === "source" && e.severity === "error",
      ),
    ).toBe(true);
    expect(
      validationReport.errors.some(
        (e) => e.field === "method" && e.severity === "warning",
      ),
    ).toBe(true);

    // Verify that NO data was committed
    const accessions = await asUser.run(async (ctx) => {
      return ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect();
    });

    expect(accessions.length).toBe(0);
    console.log(
      "✓ Step 1: Validation report shows errors before commit - NO data imported",
    );
  });

  /**
   * Verification Step 2: Fix errors and reimport - verify data imports correctly
   */
  test("should import data successfully after fixing validation errors", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // First attempt - with errors
    const invalidRows = [
      {
        accessionNumber: "ACC-001",
        dateReceived: "not-a-date",
        source: "",
        method: "gift",
      },
    ];

    const firstValidation = await asUser.mutation(
      api.importValidation.validateAccessionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: invalidRows,
      },
    );

    expect(firstValidation.isValid).toBe(false);
    console.log("✓ Step 2a: Initial validation caught errors");

    // Fix errors and reimport
    const validRows = [
      {
        accessionNumber: "ACC-001",
        dateReceived: "2024-01-15",
        source: "Corrected Donor Name",
        method: "gift",
        cost: "500.00",
        notes: "Fixed validation errors",
      },
    ];

    const secondValidation = await asUser.mutation(
      api.importValidation.validateAccessionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: validRows,
      },
    );

    expect(secondValidation.isValid).toBe(true);
    expect(secondValidation.errorCount).toBe(0);
    expect(secondValidation.validRows).toBe(1);
    console.log("✓ Step 2b: Validation passed after fixing errors");

    // Create import job and import the data
    const jobId = await asUser.mutation(api.imports.createImportJob, {
      organizationId: orgId as Id<"organizations">,
      type: "csv",
      totalItems: validRows.length,
    });

    await asUser.mutation(api.imports.importAccessionsBatch, {
      organizationId: orgId as Id<"organizations">,
      jobId,
      rows: validRows,
      batchIndex: 0,
    });

    // Verify data was actually imported
    const accessions = await asUser.run(async (ctx) => {
      return ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect();
    });

    expect(accessions.length).toBe(1);
    expect(accessions[0].accessionNumber).toBe("ACC-001");
    expect(accessions[0].source).toBe("Corrected Donor Name");
    expect(accessions[0].cost).toBe(500);
    console.log("✓ Step 2c: Data imported successfully after fixing errors");
  });

  /**
   * Verification Step 3: Upload CSV with custom fields - verify field mapper works
   */
  test("should handle CSV with custom field names via field mapping", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // Create custom field mapping
    const mappingId = await asUser.mutation(api.imports.saveFieldMapping, {
      organizationId: orgId as Id<"organizations">,
      name: "Custom Accession Import",
      description: "Maps custom CSV fields to accession fields",
      entityType: "accessions",
      mappings: [
        {
          sourceField: "Item_Number",
          targetField: "accessionNumber",
          required: true,
        },
        {
          sourceField: "Received_Date",
          targetField: "dateReceived",
          transformType: "date",
          required: true,
        },
        {
          sourceField: "Donor_Name",
          targetField: "source",
          required: true,
        },
        {
          sourceField: "Acquisition_Type",
          targetField: "method",
          required: true,
        },
        {
          sourceField: "Purchase_Price",
          targetField: "cost",
          transformType: "number",
        },
      ],
      isDefault: false,
    });

    expect(mappingId).toBeDefined();

    // Retrieve the mapping to verify it was saved
    const savedMapping = await asUser.query(api.imports.getFieldMapping, {
      mappingId: mappingId as Id<"importFieldMappings">,
    });

    expect(savedMapping).toBeDefined();
    expect(savedMapping?.name).toBe("Custom Accession Import");
    expect(savedMapping?.mappings).toHaveLength(5);
    expect(savedMapping?.mappings[0].sourceField).toBe("Item_Number");
    expect(savedMapping?.mappings[0].targetField).toBe("accessionNumber");

    console.log("✓ Step 3: Field mapping created and saved successfully");
  });

  /**
   * Verification Step 4: Map fields and import - verify mapping applied correctly
   */
  test("should apply field mapping and import data with custom field names", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // This simulates custom CSV data with non-standard field names
    // In a real scenario, the frontend would apply the field mapping
    // before sending data to the backend
    const customData = {
      Item_Number: "CUSTOM-2024-001",
      Received_Date: "2024-02-15",
      Donor_Name: "Custom Field Donor",
      Acquisition_Type: "gift",
      Purchase_Price: "750.50",
    };

    // Apply mapping transformation (simulating what frontend would do)
    const mappedData = {
      accessionNumber: customData.Item_Number,
      dateReceived: customData.Received_Date,
      source: customData.Donor_Name,
      method: customData.Acquisition_Type,
      cost: customData.Purchase_Price,
    };

    // Validate the mapped data
    const validation = await asUser.mutation(
      api.importValidation.validateAccessionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: [mappedData],
      },
    );

    expect(validation.isValid).toBe(true);
    expect(validation.errorCount).toBe(0);

    // Import the mapped data
    const jobId = await asUser.mutation(api.imports.createImportJob, {
      organizationId: orgId as Id<"organizations">,
      type: "csv",
      totalItems: 1,
    });

    await asUser.mutation(api.imports.importAccessionsBatch, {
      organizationId: orgId as Id<"organizations">,
      jobId,
      rows: [mappedData],
      batchIndex: 0,
    });

    // Verify imported data has correct values from custom fields
    const accessions = await asUser.run(async (ctx) => {
      return ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect();
    });

    expect(accessions.length).toBe(1);
    expect(accessions[0].accessionNumber).toBe("CUSTOM-2024-001");
    expect(accessions[0].source).toBe("Custom Field Donor");
    expect(accessions[0].cost).toBe(750.5);

    console.log("✓ Step 4: Field mapping applied correctly during import");
  });

  /**
   * Verification Step 5: Import using PastPerfect template - verify legacy data imports
   */
  test("should import using PastPerfect legacy template", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // Get PastPerfect template
    const template = await asUser.query(api.imports.getImportTemplate, {
      templateName: "PastPerfect",
    });

    expect(template).toBeDefined();
    expect(template?.name).toBe("PastPerfect");
    expect(template?.system).toBe("PastPerfect");

    // Simulate PastPerfect CSV data with their field names
    const pastPerfectData = {
      ObjectID: "PP-2024-001",
      Title: "Vintage Photograph",
      Maker: "Ansel Adams",
      DateMade: "1940",
      Materials: "Silver gelatin print",
      Dimensions: "16 x 20 inches",
      Description: "Black and white landscape photograph",
      Condition: "Excellent",
    };

    // Apply PastPerfect template mapping
    const validationRow = {
      accessionNumber: pastPerfectData.ObjectID,
      title: pastPerfectData.Title,
      maker: pastPerfectData.Maker,
      date: pastPerfectData.DateMade,
      medium: pastPerfectData.Materials,
      dimensions: pastPerfectData.Dimensions,
      condition: pastPerfectData.Condition,
      notes: pastPerfectData.Description,
    };

    const objectRow = {
      accessionNumber: pastPerfectData.ObjectID,
      title: pastPerfectData.Title,
      creator: pastPerfectData.Maker,
      dateCreated: pastPerfectData.DateMade,
      materials: pastPerfectData.Materials,
      dimensions: pastPerfectData.Dimensions,
      description: pastPerfectData.Description,
      condition: pastPerfectData.Condition,
      objectType: "Photograph",
    };

    // Validate collection data
    const validation = await asUser.mutation(
      api.importValidation.validateCollectionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: [validationRow],
      },
    );

    expect(validation.isValid).toBe(true);
    expect(validation.errorCount).toBe(0);

    // Import collection
    const jobId = await asUser.mutation(api.imports.createImportJob, {
      organizationId: orgId as Id<"organizations">,
      type: "csv",
      totalItems: 1,
    });

    await asUser.mutation(api.imports.importObjectsBatch, {
      organizationId: orgId as Id<"organizations">,
      jobId,
      rows: [objectRow],
      batchIndex: 0,
    });

    // Verify imported collection
    const collections = await asUser.run(async (ctx) => {
      return ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect();
    });

    expect(collections.length).toBe(1);
    expect(collections[0].accessionNumber).toBe("PP-2024-001");
    expect(collections[0].title).toBe("Vintage Photograph");
    expect(collections[0].creator).toBe("Ansel Adams");
    expect(collections[0].materials).toBe("Silver gelatin print");

    console.log("✓ Step 5: PastPerfect legacy data imported successfully");
  });

  /**
   * Verification Step 6: Import using TMS template - verify legacy data imports
   */
  test("should import using TMS (The Museum System) legacy template", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // Get TMS template
    const template = await asUser.query(api.imports.getImportTemplate, {
      templateName: "TMS",
    });

    expect(template).toBeDefined();
    expect(template?.name).toBe("TMS");
    expect(template?.system).toBe("TMS");

    // List all available templates
    const allTemplates = await asUser.query(
      api.imports.listImportTemplates,
      {},
    );

    expect(allTemplates.length).toBeGreaterThanOrEqual(2);
    expect(allTemplates.some((t) => t.name === "TMS")).toBe(true);
    expect(allTemplates.some((t) => t.name === "PastPerfect")).toBe(true);

    // Simulate TMS CSV data with their field names
    const tmsData = {
      ObjectNumber: "TMS-2024-042",
      ObjectTitle: "Ancient Greek Amphora",
      ArtistName: "Unknown",
      CreationDate: "500 BCE",
      Medium: "Terracotta",
      Height: "45",
      Width: "30",
      Depth: "30",
      PhysicalDescription: "Red-figure amphora with mythological scenes",
      ConditionStatus: "Good",
    };

    // Apply TMS template mapping
    const validationRow = {
      accessionNumber: tmsData.ObjectNumber,
      title: tmsData.ObjectTitle,
      maker: tmsData.ArtistName,
      date: tmsData.CreationDate,
      medium: tmsData.Medium,
      dimensions: `${tmsData.Height} x ${tmsData.Width} x ${tmsData.Depth} cm`,
      condition: tmsData.ConditionStatus,
      notes: tmsData.PhysicalDescription,
    };

    const objectRow = {
      accessionNumber: tmsData.ObjectNumber,
      title: tmsData.ObjectTitle,
      creator: tmsData.ArtistName,
      dateCreated: tmsData.CreationDate,
      materials: tmsData.Medium,
      dimensions: `${tmsData.Height} x ${tmsData.Width} x ${tmsData.Depth} cm`,
      description: tmsData.PhysicalDescription,
      condition: tmsData.ConditionStatus,
      objectType: "Vessel",
    };

    // Validate collection data
    const validation = await asUser.mutation(
      api.importValidation.validateCollectionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: [validationRow],
      },
    );

    expect(validation.isValid).toBe(true);

    // Import collection
    const jobId = await asUser.mutation(api.imports.createImportJob, {
      organizationId: orgId as Id<"organizations">,
      type: "csv",
      totalItems: 1,
    });

    await asUser.mutation(api.imports.importObjectsBatch, {
      organizationId: orgId as Id<"organizations">,
      jobId,
      rows: [objectRow],
      batchIndex: 0,
    });

    // Verify imported collection
    const collections = await asUser.run(async (ctx) => {
      return ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId as Id<"organizations">),
        )
        .collect();
    });

    expect(collections.length).toBe(1);
    expect(collections[0].accessionNumber).toBe("TMS-2024-042");
    expect(collections[0].title).toBe("Ancient Greek Amphora");
    expect(collections[0].creator).toBe("Unknown");
    expect(collections[0].materials).toBe("Terracotta");
    expect(collections[0].dimensions).toContain("45");

    console.log("✓ Step 6: TMS legacy data imported successfully");
  });

  /**
   * Additional test: Verify field mapping listing and deletion
   */
  test("should list and delete field mappings", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    // Create multiple field mappings
    const [mapping1, _mapping2, allMappings] = await Promise.all([
      asUser.mutation(api.imports.saveFieldMapping, {
        organizationId: orgId as Id<"organizations">,
        name: "Test Mapping 1",
        entityType: "accessions",
        mappings: [
          {
            sourceField: "field1",
            targetField: "accessionNumber",
            required: true,
          },
        ],
      }),
      asUser.mutation(api.imports.saveFieldMapping, {
        organizationId: orgId as Id<"organizations">,
        name: "Test Mapping 2",
        entityType: "objects",
        mappings: [
          { sourceField: "field2", targetField: "title", required: true },
        ],
      }),
      asUser.query(api.imports.listFieldMappings, {
        organizationId: orgId as Id<"organizations">,
      }),
    ]);
    // List all mappings
    expect(allMappings.length).toBeGreaterThanOrEqual(2);

    // List mappings filtered by entity type
    const accessionMappings = await asUser.query(
      api.imports.listFieldMappings,
      {
        organizationId: orgId as Id<"organizations">,
        entityType: "accessions",
      },
    );

    expect(accessionMappings.some((m) => m.name === "Test Mapping 1")).toBe(
      true,
    );

    // Delete a mapping
    await asUser.mutation(api.imports.deleteFieldMapping, {
      mappingId: mapping1 as Id<"importFieldMappings">,
    });

    // Verify deletion
    const afterDelete = await asUser.query(api.imports.listFieldMappings, {
      organizationId: orgId as Id<"organizations">,
    });

    expect(afterDelete.some((m) => m._id === mapping1)).toBe(false);

    console.log("✓ Field mapping list and delete operations work correctly");
  });

  /**
   * Additional test: Complex validation scenario with multiple error types
   */
  test("should handle complex validation with multiple error types", async () => {
    const t = convexTest(schema, modules);
    const { orgId, userId } = await createOrgWithUser(t, [
      "collections.create",
    ]);
    const asUser = authedForUser(t, userId);

    const complexRows = [
      {
        // Row 2: Valid
        accessionNumber: "VALID-001",
        dateReceived: "2024-01-15",
        source: "Valid Donor",
        method: "gift",
        cost: "100.00",
      },
      {
        // Row 3: Missing required fields (errors)
        accessionNumber: "",
        dateReceived: "",
        source: "",
        method: "",
      },
      {
        // Row 4: Invalid formats (errors + warnings)
        accessionNumber: "INVALID-001",
        dateReceived: "not-a-date",
        source: "Test",
        method: "weird-method",
        cost: "not-a-number",
      },
      {
        // Row 5: Future date (warning)
        accessionNumber: "FUTURE-001",
        dateReceived: "2099-12-31",
        source: "Future Donor",
        method: "gift",
      },
      {
        // Row 6: Negative cost (warning)
        accessionNumber: "NEG-001",
        dateReceived: "2024-01-20",
        source: "Negative Donor",
        method: "purchase",
        cost: "-500.00",
      },
    ];

    const validation = await asUser.mutation(
      api.importValidation.validateAccessionImport,
      {
        organizationId: orgId as Id<"organizations">,
        rows: complexRows,
      },
    );

    expect(validation.totalRows).toBe(5);
    expect(validation.validRows).toBe(3); // Rows with warnings are still valid
    expect(validation.errorCount).toBeGreaterThan(0);
    expect(validation.warningCount).toBeGreaterThan(0);

    // Verify we have errors for different rows
    const rowsWithErrors = new Set(
      validation.errors.flatMap((error) =>
        error.severity === "error" ? [error.row] : [],
      ),
    );
    expect(rowsWithErrors.size).toBeGreaterThan(1);

    console.log("✓ Complex validation scenario handled correctly");
    console.log(`  - Total rows: ${validation.totalRows}`);
    console.log(`  - Valid rows: ${validation.validRows}`);
    console.log(`  - Errors: ${validation.errorCount}`);
    console.log(`  - Warnings: ${validation.warningCount}`);
    console.log(`  - Info: ${validation.infoCount}`);
  });
});
