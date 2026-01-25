import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createTestSetup(
  t: ReturnType<typeof convexTest>,
): Promise<TestSetup> {
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Test Museum",
      slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
  });

  const accountsReadPermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.read",
      category: "accounts",
    });
  });

  const accountsWritePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.write",
      category: "accounts",
    });
  });

  const accountsDeletePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.delete",
      category: "accounts",
    });
  });

  const accountsManagePermissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "accounts.manage",
      category: "accounts",
    });
  });

  const roleId = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: accountsReadPermissionId,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: accountsWritePermissionId,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: accountsDeletePermissionId,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: accountsManagePermissionId,
    });

    return roleId;
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId };
}

describe("Accounts CRUD", () => {
  test("should create account with auto-generated account number", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-create`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Test Lender Inc",
      email: "lender@example.com",
    });

    expect(accountId).toBeDefined();

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account).toBeDefined();
    expect(account?.accountNumber).toMatch(/^ACC-\d{5}$/);
    expect(account?.businessName).toBe("Test Lender Inc");
    expect(account?.accountType).toBe("lender");
  });

  test("should list accounts with pagination", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-list`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Lender 1",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "borrower",
      businessName: "Borrower 1",
    });

    const result = await authed.query(api.accounts.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.accounts).toHaveLength(2);
    expect(result.isDone).toBe(true);
  });

  test("should filter accounts by type", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-filter`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Lender 1",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "borrower",
      businessName: "Borrower 1",
    });

    const result = await authed.query(api.accounts.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
      accountType: "lender",
    });

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]?.accountType).toBe("lender");
  });

  test("should search accounts by name", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-search`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "ABC Corporation",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "borrower",
      businessName: "XYZ Industries",
    });

    const result = await authed.query(api.accounts.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
      search: "ABC",
    });

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]?.businessName).toBe("ABC Corporation");
  });

  test("should update account", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-update`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Original Name",
    });

    await authed.mutation(api.accounts.update, {
      accountId,
      businessName: "Updated Name",
      email: "updated@example.com",
    });

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account?.businessName).toBe("Updated Name");
    expect(account?.email).toBe("updated@example.com");
  });

  test("should archive account", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-archive`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Test Account",
    });

    await authed.mutation(api.accounts.archive, { accountId });

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account?.status).toBe("archived");
  });

  test("should restore archived account", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-restore`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Test Account",
    });

    await authed.mutation(api.accounts.archive, { accountId });
    await authed.mutation(api.accounts.restore, { accountId });

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account?.status).toBe("active");
  });

  test("should update account status", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-status`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "patron",
      firstName: "John",
      lastName: "Doe",
    });

    await authed.mutation(api.accounts.updateStatus, {
      accountId,
      status: "suspended",
    });

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account?.status).toBe("suspended");
  });

  test("should get account by name", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-getbyname`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Unique Corporation",
    });

    const account = await authed.query(api.accounts.getByName, {
      organizationId,
      name: "Unique Corporation",
    });

    expect(account).toBeDefined();
    expect(account?.businessName).toBe("Unique Corporation");
  });

  test("should enforce module gating", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-gating`,
      issuer: "https://example.test",
    });

    const orgWithoutModule = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "No Accounts Module",
        slug: `no-accounts-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        settings: {
          enabledModules: [],
        },
      });
    });

    await expect(
      authed.query(api.accounts.list, {
        organizationId: orgWithoutModule,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Module not enabled: accounts");
  });

  test("should enforce multi-tenant isolation", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-isolation`,
      issuer: "https://example.test",
    });

    const org2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Museum",
        slug: `other-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Org 1 Account",
    });

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account?.organizationId).toBe(organizationId);
    expect(account?.organizationId).not.toBe(org2Id);
  });

  test("should prevent deletion of account used in loans", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-delete`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "lender",
      businessName: "Lender with Loan",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "L2025.01.0001",
        type: "incoming",
        accountId,
        lenderBorrowerName: "Lender with Loan",
        startDate: Date.now(),
        status: "pending",
      });
    });

    await expect(
      authed.mutation(api.accounts.remove, { accountId }),
    ).rejects.toThrow("Cannot delete account that is used in existing loans");
  });

  test("should create patron account with required fields", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-patron`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "patron",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      cardNumber: "CARD-001",
    });

    const account = await authed.query(api.accounts.get, { accountId });
    expect(account?.accountType).toBe("patron");
    expect(account?.firstName).toBe("Jane");
    expect(account?.lastName).toBe("Smith");
    expect(account?.cardNumber).toBe("CARD-001");
  });

  test("should validate patron account requires name", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-validate-patron`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.accounts.create, {
        organizationId,
        accountType: "patron",
        email: "test@example.com",
      }),
    ).rejects.toThrow(
      "First name and last name are required for patron accounts",
    );
  });

  test("should validate non-patron account requires business name", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-validate-business`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.accounts.create, {
        organizationId,
        accountType: "lender",
        email: "test@example.com",
      }),
    ).rejects.toThrow("Business name is required for non-patron accounts");
  });
});
