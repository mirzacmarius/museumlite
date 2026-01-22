import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("accountDocuments: create and list", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const storageId = await t.run(async (ctx) => {
    return await ctx.db.insert("_storage", {});
  });

  const writePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.write",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: writePermissionId,
    });
  });

  const documentId = await t.mutation(api.accountDocuments.create, {
    accountId,
    storageId,
    filename: "test.pdf",
    mimeType: "application/pdf",
    size: 1024,
    documentType: "contract",
    description: "Test document",
  });

  expect(documentId).toBeDefined();

  const documents = await t.query(api.accountDocuments.list, {
    accountId,
  });

  expect(documents).toHaveLength(1);
  expect(documents[0].filename).toBe("test.pdf");
  expect(documents[0].documentType).toBe("contract");
});

test("accountDocuments: get with download URL", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const storageId = await t.run(async (ctx) => {
    return await ctx.db.insert("_storage", {});
  });

  const documentId = await t.run(async (ctx) => {
    return await ctx.db.insert("accountDocuments", {
      organizationId: orgId,
      accountId,
      storageId,
      filename: "test.pdf",
      mimeType: "application/pdf",
      size: 1024,
      documentType: "contract",
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });
  });

  const document = await t.query(api.accountDocuments.get, {
    documentId,
  });

  expect(document).toBeDefined();
  expect(document?.filename).toBe("test.pdf");
  expect(document?.downloadUrl).toBeDefined();
});

test("accountDocuments: remove", async () => {
  const t = convexTest(schema, modules);

  const orgId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Org",
      slug: "test-org",
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {});
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  const deletePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.delete",
      category: "accounts",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: deletePermissionId,
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  const accountId = await t.run(async (ctx) => {
    return await ctx.db.insert("accounts", {
      organizationId: orgId,
      accountNumber: "ACC-00001",
      accountType: "institution",
      businessName: "Test Institution",
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  const storageId = await t.run(async (ctx) => {
    return await ctx.db.insert("_storage", {});
  });

  const documentId = await t.run(async (ctx) => {
    return await ctx.db.insert("accountDocuments", {
      organizationId: orgId,
      accountId,
      storageId,
      filename: "test.pdf",
      mimeType: "application/pdf",
      size: 1024,
      documentType: "contract",
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });
  });

  await t.mutation(api.accountDocuments.remove, {
    documentId,
  });

  const document = await t.run(async (ctx) => {
    return await ctx.db.get(documentId);
  });

  expect(document).toBeNull();
});
