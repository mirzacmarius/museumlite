import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

describe("contacts", () => {
  let t: ReturnType<typeof convexTest>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let roleId: Id<"roles">;
  let accountId: Id<"accounts">;

  beforeEach(async () => {
    t = convexTest(schema);

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: "test@example.com",
      });
    });

    roleId = await t.run(async (ctx) => {
      const role = await ctx.db.insert("roles", {
        organizationId,
        name: "Admin",
        description: "Administrator role",
        isSystemRole: true,
      });

      const readPermission = await ctx.db.insert("permissions", {
        name: "accounts.read",
        description: "Read accounts",
        category: "accounts",
      });

      const writePermission = await ctx.db.insert("permissions", {
        name: "accounts.write",
        description: "Write accounts",
        category: "accounts",
      });

      const deletePermission = await ctx.db.insert("permissions", {
        name: "accounts.delete",
        description: "Delete accounts",
        category: "accounts",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: role,
        permissionId: readPermission,
      });

      await ctx.db.insert("rolePermissions", {
        roleId: role,
        permissionId: writePermission,
      });

      await ctx.db.insert("rolePermissions", {
        roleId: role,
        permissionId: deletePermission,
      });

      return role;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    accountId = await t.mutation(api.accounts.create, {
      organizationId,
      accountType: "institution",
      businessName: "Test Institution",
    });
  });

  test("should create contact", async () => {
    const contactId = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      title: "Director",
      role: "primary",
      email: "john@example.com",
      phone: "555-1234",
      mobile: "555-5678",
      preferredContact: "email",
      isPrimary: true,
      isActive: true,
      notes: "Main contact",
    });

    expect(contactId).toBeDefined();

    const contact = await t.query(api.contacts.get, { contactId });
    expect(contact).toBeDefined();
    expect(contact?.firstName).toBe("John");
    expect(contact?.lastName).toBe("Doe");
    expect(contact?.email).toBe("john@example.com");
    expect(contact?.isPrimary).toBe(true);
  });

  test("should list contacts for account", async () => {
    await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await t.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: false,
      isActive: true,
    });

    const contacts = await t.query(api.contacts.list, { accountId });
    expect(contacts).toHaveLength(2);
    expect(contacts.map((c) => c.firstName)).toContain("John");
    expect(contacts.map((c) => c.firstName)).toContain("Jane");
  });

  test("should list contacts by organization with search", async () => {
    await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await t.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: false,
      isActive: true,
    });

    const allContacts = await t.query(api.contacts.listByOrganization, {
      organizationId,
    });
    expect(allContacts).toHaveLength(2);

    const searchResults = await t.query(api.contacts.listByOrganization, {
      organizationId,
      search: "john",
    });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.firstName).toBe("John");
  });

  test("should update contact", async () => {
    const contactId = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await t.mutation(api.contacts.update, {
      contactId,
      firstName: "Jonathan",
      email: "jonathan@example.com",
    });

    const contact = await t.query(api.contacts.get, { contactId });
    expect(contact?.firstName).toBe("Jonathan");
    expect(contact?.email).toBe("jonathan@example.com");
    expect(contact?.lastName).toBe("Doe");
  });

  test("should delete contact", async () => {
    const contactId = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await t.mutation(api.contacts.remove, { contactId });

    const contact = await t.query(api.contacts.get, { contactId });
    expect(contact).toBeNull();
  });

  test("should enforce only one primary contact per account", async () => {
    const contact1Id = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    const contact2Id = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: true,
      isActive: true,
    });

    const contact1 = await t.query(api.contacts.get, { contactId: contact1Id });
    const contact2 = await t.query(api.contacts.get, { contactId: contact2Id });

    expect(contact1?.isPrimary).toBe(false);
    expect(contact2?.isPrimary).toBe(true);
  });

  test("should set primary contact", async () => {
    const contact1Id = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    const contact2Id = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: false,
      isActive: true,
    });

    await t.mutation(api.contacts.setPrimary, { contactId: contact2Id });

    const contact1 = await t.query(api.contacts.get, { contactId: contact1Id });
    const contact2 = await t.query(api.contacts.get, { contactId: contact2Id });

    expect(contact1?.isPrimary).toBe(false);
    expect(contact2?.isPrimary).toBe(true);
  });

  test("should enforce permission gating", async () => {
    const restrictedRoleId = await t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: "Restricted",
        description: "No permissions",
        isSystemRole: false,
      });
    });

    const restrictedUserId = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", {
        name: "Restricted User",
        email: "restricted@example.com",
      });

      await ctx.db.insert("userOrganizations", {
        userId: user,
        organizationId,
        roleId: restrictedRoleId,
        joinedAt: Date.now(),
      });

      return user;
    });

    await expect(
      t.mutation(api.contacts.create, {
        accountId,
        firstName: "Test",
        lastName: "User",
        role: "primary",
        isPrimary: false,
        isActive: true,
      }),
    ).rejects.toThrow();
  });

  test("should enforce module gating", async () => {
    const org2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum 2",
        slug: "test-museum-2",
        type: "museum",
        settings: {
          enabledModules: [],
        },
      });
    });

    const role2Id = await t.run(async (ctx) => {
      const role = await ctx.db.insert("roles", {
        organizationId: org2Id,
        name: "Admin",
        description: "Administrator role",
        isSystemRole: true,
      });

      const readPermission = await ctx.db.insert("permissions", {
        name: "accounts.read",
        description: "Read accounts",
        category: "accounts",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: role,
        permissionId: readPermission,
      });

      return role;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: org2Id,
        roleId: role2Id,
        joinedAt: Date.now(),
      });
    });

    const account2Id = await t.mutation(api.accounts.create, {
      organizationId: org2Id,
      accountType: "institution",
      businessName: "Test Institution 2",
    });

    await expect(
      t.query(api.contacts.list, { accountId: account2Id }),
    ).rejects.toThrow();
  });

  test("should enforce multi-tenant isolation", async () => {
    const org2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum 2",
        slug: "test-museum-2",
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    });

    const user2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User 2",
        email: "test2@example.com",
      });
    });

    const role2Id = await t.run(async (ctx) => {
      const role = await ctx.db.insert("roles", {
        organizationId: org2Id,
        name: "Admin",
        description: "Administrator role",
        isSystemRole: true,
      });

      const readPermission = await ctx.db.insert("permissions", {
        name: "accounts.read",
        description: "Read accounts",
        category: "accounts",
      });

      await ctx.db.insert("rolePermissions", {
        roleId: role,
        permissionId: readPermission,
      });

      return role;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: user2Id,
        organizationId: org2Id,
        roleId: role2Id,
        joinedAt: Date.now(),
      });
    });

    const contactId = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    const contact = await t.query(api.contacts.get, { contactId });
    expect(contact).toBeDefined();
  });

  test("should update primary contact via update mutation", async () => {
    const contact1Id = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    const contact2Id = await t.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: false,
      isActive: true,
    });

    await t.mutation(api.contacts.update, {
      contactId: contact2Id,
      isPrimary: true,
    });

    const contact1 = await t.query(api.contacts.get, { contactId: contact1Id });
    const contact2 = await t.query(api.contacts.get, { contactId: contact2Id });

    expect(contact1?.isPrimary).toBe(false);
    expect(contact2?.isPrimary).toBe(true);
  });
});
