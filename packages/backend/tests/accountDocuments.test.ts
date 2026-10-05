import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

test("accountDocuments: create and list", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, permissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.read",
        category: "accounts",
      });
    }),
  ]);
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

  await t.run(async (ctx) => {
    const permissionId = await ctx.db.insert("permissions", {
      name: "organization.manage_settings",
      category: "organization",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session-create-and-list`,
    issuer: "https://example.test",
  });

  const uploadUrl = new URL(
    await authed.mutation(api.accountDocuments.generateUploadUrl, {
      accountId,
    }),
  );
  const response = await t.fetch(uploadUrl.pathname + uploadUrl.search, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: new Blob([new Uint8Array(1024)], { type: "application/pdf" }),
  });
  expect(response.status).toBe(200);
  const { storageId }: { storageId: Id<"_storage"> } = await response.json();
  const documentId = await authed.mutation(api.accountDocuments.create, {
    accountId,
    storageId,
    filename: "test.pdf",
    mimeType: "application/pdf",
    size: 1024,
    documentType: "contract",
    description: "Test document",
  });

  expect(documentId).toBeDefined();

  const documents = await authed.query(api.accountDocuments.list, {
    accountId,
  });

  expect(documents).toHaveLength(1);
  expect(documents[0].filename).toBe("test.pdf");
  expect(documents[0].documentType).toBe("contract");
});

test("accountDocuments: get with download URL", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, permissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.read",
        category: "accounts",
      });
    }),
  ]);
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

  // Mock storage ID - _storage is a system table and can't be inserted in tests
  const storageId = "0e9655dc186fb9e9;_storage" as Id<"_storage">;

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

  const authed = t.withIdentity({
    subject: `${userId}|session-get-with-download-url`,
    issuer: "https://example.test",
  });

  const document = await authed.query(api.accountDocuments.get, {
    documentId,
  });

  expect(document).toBeDefined();
  expect(document?.filename).toBe("test.pdf");
  expect(document?.downloadUrl).toBeDefined();
});

test("accountDocuments: remove", async () => {
  const t = convexTest(schema, modules);

  const [orgId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    }),
  ]);
  const [roleId, deletePermissionId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Admin",
        isSystemRole: true,
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: "accounts.delete",
        category: "accounts",
      });
    }),
  ]);
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

  // Mock storage ID - _storage is a system table and can't be inserted in tests
  const storageId = "0e9655dc186fb9e9;_storage" as Id<"_storage">;

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

  await t.run(async (ctx) => {
    const permissionId = await ctx.db.insert("permissions", {
      name: "organization.manage_settings",
      category: "organization",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
  });

  const authed = t.withIdentity({
    subject: `${userId}|session-remove`,
    issuer: "https://example.test",
  });

  await authed.mutation(api.accountDocuments.remove, {
    documentId,
  });

  const document = await t.run(async (ctx) => {
    return await ctx.db.get(documentId);
  });

  expect(document).toBeNull();
});
