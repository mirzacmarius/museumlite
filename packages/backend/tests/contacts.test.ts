import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("contacts", () => {
  let t: ReturnType<typeof convexTest>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let roleId: Id<"roles">;
  let accountId: Id<"accounts">;

  beforeEach(async () => {
    t = convexTest(schema, modules);

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
      const [role, readPermission, writePermission, deletePermission] =
        await Promise.all([
          ctx.db.insert("roles", {
            organizationId,
            name: "Admin",
            description: "Administrator role",
            isSystemRole: true,
          }),
          ctx.db.insert("permissions", {
            name: "accounts.read",
            description: "Read accounts",
            category: "accounts",
          }),
          ctx.db.insert("permissions", {
            name: "accounts.write",
            description: "Write accounts",
            category: "accounts",
          }),
          ctx.db.insert("permissions", {
            name: "accounts.delete",
            description: "Delete accounts",
            category: "accounts",
          }),
        ]);
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

    await t.run(async (ctx) => {
      const permissionId = await ctx.db.insert("permissions", {
        name: "organization.manage_settings",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-setup`,
      issuer: "https://example.test",
    });

    accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "institution",
      businessName: "Test Institution",
    });
  });

  test("should create contact", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-create-contact`,
      issuer: "https://example.test",
    });

    const contactId = await authed.mutation(api.contacts.create, {
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

    const contact = await authed.query(api.contacts.get, { contactId });
    expect(contact).toBeDefined();
    expect(contact?.firstName).toBe("John");
    expect(contact?.lastName).toBe("Doe");
    expect(contact?.email).toBe("john@example.com");
    expect(contact?.isPrimary).toBe(true);
  });

  test("should list contacts for account", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-list-contacts`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: false,
      isActive: true,
    });

    const contacts = await authed.query(api.contacts.list, { accountId });
    expect(contacts).toHaveLength(2);
    expect(contacts.map((c) => c.firstName)).toContain("John");
    expect(contacts.map((c) => c.firstName)).toContain("Jane");
  });

  test("should list contacts by organization with search", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-list-org-search`,
      issuer: "https://example.test",
    });

    await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "Jane",
      lastName: "Smith",
      role: "billing",
      isPrimary: false,
      isActive: true,
    });

    const allContacts = await authed.query(api.contacts.listByOrganization, {
      organizationId,
    });
    expect(allContacts).toHaveLength(2);

    const searchResults = await authed.query(api.contacts.listByOrganization, {
      organizationId,
      search: "john",
    });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.firstName).toBe("John");
  });

  test("should update contact", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-update-contact`,
      issuer: "https://example.test",
    });

    const contactId = await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await authed.mutation(api.contacts.update, {
      contactId,
      firstName: "Jonathan",
      email: "jonathan@example.com",
    });

    const contact = await authed.query(api.contacts.get, { contactId });
    expect(contact?.firstName).toBe("Jonathan");
    expect(contact?.email).toBe("jonathan@example.com");
    expect(contact?.lastName).toBe("Doe");
  });

  test("should delete contact", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-delete-contact`,
      issuer: "https://example.test",
    });

    const contactId = await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    await authed.mutation(api.contacts.remove, { contactId });

    const contact = await authed.query(api.contacts.get, { contactId });
    expect(contact).toBeNull();
  });

  test("should enforce only one primary contact per account", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-primary-contact`,
      issuer: "https://example.test",
    });

    const [contact1Id, contact2Id] = await Promise.all([
      authed.mutation(api.contacts.create, {
        accountId,
        firstName: "John",
        lastName: "Doe",
        role: "primary",
        isPrimary: true,
        isActive: true,
      }),
      authed.mutation(api.contacts.create, {
        accountId,
        firstName: "Jane",
        lastName: "Smith",
        role: "billing",
        isPrimary: true,
        isActive: true,
      }),
    ]);
    const [contact1, contact2] = await Promise.all([
      authed.query(api.contacts.get, {
        contactId: contact1Id,
      }),
      authed.query(api.contacts.get, {
        contactId: contact2Id,
      }),
    ]);
    expect(contact1?.isPrimary).toBe(false);
    expect(contact2?.isPrimary).toBe(true);
  });

  test("should set primary contact", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-set-primary`,
      issuer: "https://example.test",
    });

    const [contact1Id, contact2Id] = await Promise.all([
      authed.mutation(api.contacts.create, {
        accountId,
        firstName: "John",
        lastName: "Doe",
        role: "primary",
        isPrimary: true,
        isActive: true,
      }),
      authed.mutation(api.contacts.create, {
        accountId,
        firstName: "Jane",
        lastName: "Smith",
        role: "billing",
        isPrimary: false,
        isActive: true,
      }),
    ]);
    await authed.mutation(api.contacts.setPrimary, { contactId: contact2Id });

    const [contact1, contact2] = await Promise.all([
      authed.query(api.contacts.get, {
        contactId: contact1Id,
      }),
      authed.query(api.contacts.get, {
        contactId: contact2Id,
      }),
    ]);
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

    const authed = t.withIdentity({
      subject: `${restrictedUserId}|session-permission-gating`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.contacts.create, {
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
      const [role, readPermission] = await Promise.all([
        ctx.db.insert("roles", {
          organizationId: org2Id,
          name: "Admin",
          description: "Administrator role",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "accounts.read",
          description: "Read accounts",
          category: "accounts",
        }),
      ]);
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

    const account2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("accounts", {
        organizationId: org2Id,
        accountNumber: "ACC-00002",
        accountType: "institution",
        businessName: "Test Institution 2",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-module-gating`,
      issuer: "https://example.test",
    });

    await expect(
      authed.query(api.contacts.list, { accountId: account2Id }),
    ).rejects.toThrow();
  });

  test("should enforce multi-tenant isolation", async () => {
    const [org2Id, user2Id] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum 2",
          slug: "test-museum-2",
          type: "museum",
          settings: {
            enabledModules: ["accounts"],
          },
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User 2",
          email: "test2@example.com",
        });
      }),
    ]);
    const role2Id = await t.run(async (ctx) => {
      const [role, readPermission] = await Promise.all([
        ctx.db.insert("roles", {
          organizationId: org2Id,
          name: "Admin",
          description: "Administrator role",
          isSystemRole: true,
        }),
        ctx.db.insert("permissions", {
          name: "accounts.read",
          description: "Read accounts",
          category: "accounts",
        }),
      ]);
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

    const authed = t.withIdentity({
      subject: `${userId}|session-multi-tenant`,
      issuer: "https://example.test",
    });

    const contactId = await authed.mutation(api.contacts.create, {
      accountId,
      firstName: "John",
      lastName: "Doe",
      role: "primary",
      isPrimary: true,
      isActive: true,
    });

    const contact = await authed.query(api.contacts.get, { contactId });
    expect(contact).toBeDefined();
  });

  test("should update primary contact via update mutation", async () => {
    const authed = t.withIdentity({
      subject: `${userId}|session-update-primary`,
      issuer: "https://example.test",
    });

    const [contact1Id, contact2Id] = await Promise.all([
      authed.mutation(api.contacts.create, {
        accountId,
        firstName: "John",
        lastName: "Doe",
        role: "primary",
        isPrimary: true,
        isActive: true,
      }),
      authed.mutation(api.contacts.create, {
        accountId,
        firstName: "Jane",
        lastName: "Smith",
        role: "billing",
        isPrimary: false,
        isActive: true,
      }),
    ]);
    await authed.mutation(api.contacts.update, {
      contactId: contact2Id,
      isPrimary: true,
    });

    const [contact1, contact2] = await Promise.all([
      authed.query(api.contacts.get, {
        contactId: contact1Id,
      }),
      authed.query(api.contacts.get, {
        contactId: contact2Id,
      }),
    ]);
    expect(contact1?.isPrimary).toBe(false);
    expect(contact2?.isPrimary).toBe(true);
  });
});
