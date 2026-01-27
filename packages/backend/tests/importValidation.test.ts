import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

import { modules } from "./testSetup";

const createOrg = () => ({
  name: "Test Museum",
  slug: "test-museum",
  type: "museum" as const,
  subscriptionTier: "pro" as const,
});

const createUser = () => ({
  name: "Test User",
  email: "test@example.com",
});

describe("Import Validation - Accessions", () => {
  test("should validate valid accession data", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", createOrg());
      const userId = await ctx.db.insert("users", createUser());

      const adminRole = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId: adminRole,
        joinedAt: Date.now(),
      });

      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permissionId,
      });

      return { orgId, userId };
    });

    const result = await t.mutation(api.importValidation.validateAccessionImport, {
      organizationId: orgId,
      rows: [
        {
          accessionNumber: "2024.001",
          dateReceived: "2024-01-15",
          source: "John Doe Collection",
          method: "gift",
          cost: "1000.00",
          notes: "Test item",
        },
      ],
    });

    expect(result.isValid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
  });

  test("should detect missing required fields", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", createOrg());
      const userId = await ctx.db.insert("users", createUser());

      const adminRole = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId: adminRole,
        joinedAt: Date.now(),
      });

      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permissionId,
      });

      return { orgId, userId };
    });

    const result = await t.mutation(api.importValidation.validateAccessionImport, {
      organizationId: orgId,
      rows: [
        {
          dateReceived: "",
          source: "",
          method: "gift",
        },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.field === "source")).toBe(true);
    expect(result.errors.some((e) => e.field === "dateReceived")).toBe(true);
  });

  test("should detect invalid date format", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", createOrg());
      const userId = await ctx.db.insert("users", createUser());

      const adminRole = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId: adminRole,
        joinedAt: Date.now(),
      });

      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permissionId,
      });

      return { orgId, userId };
    });

    const result = await t.mutation(api.importValidation.validateAccessionImport, {
      organizationId: orgId,
      rows: [
        {
          dateReceived: "not-a-date",
          source: "Test Source",
          method: "gift",
        },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "dateReceived" && e.severity === "error")).toBe(true);
  });

  test("should warn about invalid method but not fail", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", createOrg());
      const userId = await ctx.db.insert("users", createUser());

      const adminRole = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId: adminRole,
        joinedAt: Date.now(),
      });

      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permissionId,
      });

      return { orgId, userId };
    });

    const result = await t.mutation(api.importValidation.validateAccessionImport, {
      organizationId: orgId,
      rows: [
        {
          dateReceived: "2024-01-15",
          source: "Test Source",
          method: "invalid-method",
        },
      ],
    });

    expect(result.errors.some((e) => e.field === "method" && e.severity === "warning")).toBe(true);
  });

  test("should detect invalid cost format", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", createOrg());
      const userId = await ctx.db.insert("users", createUser());

      const adminRole = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId: adminRole,
        joinedAt: Date.now(),
      });

      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permissionId,
      });

      return { orgId, userId };
    });

    const result = await t.mutation(api.importValidation.validateAccessionImport, {
      organizationId: orgId,
      rows: [
        {
          dateReceived: "2024-01-15",
          source: "Test Source",
          method: "gift",
          cost: "not-a-number",
        },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "cost" && e.severity === "error")).toBe(true);
  });

  test("should validate multiple rows and report all errors", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", createOrg());
      const userId = await ctx.db.insert("users", createUser());

      const adminRole = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId: adminRole,
        joinedAt: Date.now(),
      });

      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.create",
        category: "collections",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: adminRole,
        permissionId: permissionId,
      });

      return { orgId, userId };
    });

    const result = await t.mutation(api.importValidation.validateAccessionImport, {
      organizationId: orgId,
      rows: [
        {
          dateReceived: "2024-01-15",
          source: "Valid Source",
          method: "gift",
        },
        {
          dateReceived: "",
          source: "",
          method: "",
        },
        {
          dateReceived: "invalid-date",
          source: "Test",
          method: "gift",
        },
      ],
    });

    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(1);
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
