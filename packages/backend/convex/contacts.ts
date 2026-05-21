import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  requireAuthenticatedUser,
  requireAuthorizedOrganization,
} from "./utils/authorizationContext";

const roleValidator = v.union(
  v.literal("primary"),
  v.literal("billing"),
  v.literal("shipping"),
  v.literal("technical"),
);

const preferredContactValidator = v.union(
  v.literal("email"),
  v.literal("phone"),
  v.literal("mobile"),
);

/**
 * List contacts for a specific account
 */
export const list = query({
  args: {
    accountId: v.id("accounts"),
  },
  returns: v.array(
    v.object({
      _id: v.id("contacts"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      firstName: v.string(),
      lastName: v.string(),
      title: v.optional(v.string()),
      role: roleValidator,
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      mobile: v.optional(v.string()),
      preferredContact: v.optional(preferredContactValidator),
      isPrimary: v.boolean(),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    // Get account to check organization
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireAuthorizedOrganization(ctx, {
      organizationId: account.organizationId,
      moduleId: "accounts",
      permission: "accounts.read",
    });

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    return contacts;
  },
});

/**
 * List contacts across all accounts in an organization
 */
export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("contacts"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      firstName: v.string(),
      lastName: v.string(),
      title: v.optional(v.string()),
      role: roleValidator,
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      mobile: v.optional(v.string()),
      preferredContact: v.optional(preferredContactValidator),
      isPrimary: v.boolean(),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAuthorizedOrganization(ctx, {
      organizationId: args.organizationId,
      moduleId: "accounts",
      permission: "accounts.read",
    });

    let contacts = await ctx.db
      .query("contacts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // Filter by search if provided
    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      contacts = contacts.filter((contact) => {
        const firstNameMatch = contact.firstName
          .toLowerCase()
          .includes(searchLower);
        const lastNameMatch = contact.lastName
          .toLowerCase()
          .includes(searchLower);
        const emailMatch = contact.email?.toLowerCase().includes(searchLower);
        const titleMatch = contact.title?.toLowerCase().includes(searchLower);
        return firstNameMatch || lastNameMatch || emailMatch || titleMatch;
      });
    }

    // Apply limit if provided
    if (args.limit && args.limit > 0) {
      contacts = contacts.slice(0, args.limit);
    }

    return contacts;
  },
});

/**
 * Get a single contact by ID
 */
export const get = query({
  args: {
    contactId: v.id("contacts"),
  },
  returns: v.union(
    v.object({
      _id: v.id("contacts"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      accountId: v.id("accounts"),
      firstName: v.string(),
      lastName: v.string(),
      title: v.optional(v.string()),
      role: roleValidator,
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      mobile: v.optional(v.string()),
      preferredContact: v.optional(preferredContactValidator),
      isPrimary: v.boolean(),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      return null;
    }

    // Get account to check organization
    const account = await ctx.db.get(contact.accountId);
    if (!account) {
      return null;
    }

    await requireAuthorizedOrganization(ctx, {
      organizationId: account.organizationId,
      moduleId: "accounts",
      permission: "accounts.read",
    });

    return contact;
  },
});

/**
 * Create a new contact
 */
export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    firstName: v.string(),
    lastName: v.string(),
    title: v.optional(v.string()),
    role: roleValidator,
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    mobile: v.optional(v.string()),
    preferredContact: v.optional(preferredContactValidator),
    isPrimary: v.boolean(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    const [userId, account] = await Promise.all([
      requireAuthenticatedUser(ctx),
      ctx.db.get(args.accountId),
    ] as const);

    // Get account to check organization
    if (!account) {
      throw new Error("Account not found");
    }

    await requireAuthorizedOrganization(ctx, {
      organizationId: account.organizationId,
      moduleId: "accounts",
      permission: "accounts.write",
    });

    // If setting this contact as primary, unset other primary contacts for this account
    if (args.isPrimary) {
      const existingPrimaryContacts = await ctx.db
        .query("contacts")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .collect();

      await Promise.all(
        existingPrimaryContacts.map((contact) =>
          contact.isPrimary
            ? ctx.db.patch(contact._id, {
                isPrimary: false,
                updatedAt: Date.now(),
              })
            : Promise.resolve(),
        ),
      );
    }

    const contactId = await ctx.db.insert("contacts", {
      organizationId: account.organizationId,
      accountId: args.accountId,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      title: args.title?.trim(),
      role: args.role,
      email: args.email?.trim(),
      phone: args.phone?.trim(),
      mobile: args.mobile?.trim(),
      preferredContact: args.preferredContact,
      isPrimary: args.isPrimary,
      isActive: args.isActive,
      notes: args.notes?.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: account.organizationId,
      userId,
      action: "created_contact",
      entityType: "contact",
      entityId: contactId,
      changes: {
        firstName: args.firstName.trim(),
        lastName: args.lastName.trim(),
        role: args.role,
        accountId: args.accountId,
      },
    });

    return contactId;
  },
});

/**
 * Update an existing contact
 */
export const update = mutation({
  args: {
    contactId: v.id("contacts"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    role: v.optional(roleValidator),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    mobile: v.optional(v.string()),
    preferredContact: v.optional(preferredContactValidator),
    isPrimary: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, contact] = await Promise.all([
      requireAuthenticatedUser(ctx),
      ctx.db.get(args.contactId),
    ] as const);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Get account to check organization
    const account = await ctx.db.get(contact.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    await requireAuthorizedOrganization(ctx, {
      organizationId: account.organizationId,
      moduleId: "accounts",
      permission: "accounts.write",
    });

    // If setting this contact as primary, unset other primary contacts for this account
    if (args.isPrimary === true) {
      const existingPrimaryContacts = await ctx.db
        .query("contacts")
        .withIndex("by_account", (q) => q.eq("accountId", contact.accountId))
        .collect();

      await Promise.all(
        Array.from(existingPrimaryContacts).map(async (existingContact) => {
          if (
            existingContact._id !== args.contactId &&
            existingContact.isPrimary
          ) {
            await ctx.db.patch(existingContact._id, {
              isPrimary: false,
              updatedAt: Date.now(),
            });
          }
        }),
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName.trim();
    if (args.lastName !== undefined) updates.lastName = args.lastName.trim();
    if (args.title !== undefined) updates.title = args.title?.trim();
    if (args.role !== undefined) updates.role = args.role;
    if (args.email !== undefined) updates.email = args.email?.trim();
    if (args.phone !== undefined) updates.phone = args.phone?.trim();
    if (args.mobile !== undefined) updates.mobile = args.mobile?.trim();
    if (args.preferredContact !== undefined)
      updates.preferredContact = args.preferredContact;
    if (args.isPrimary !== undefined) updates.isPrimary = args.isPrimary;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.notes !== undefined) updates.notes = args.notes?.trim();

    await Promise.all([
      ctx.db.patch(args.contactId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "updated_contact",
        entityType: "contact",
        entityId: args.contactId,
        changes: updates,
      }),
    ]);

    return null;
  },
});

/**
 * Delete a contact
 */
export const remove = mutation({
  args: {
    contactId: v.id("contacts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, contact] = await Promise.all([
      requireAuthenticatedUser(ctx),
      ctx.db.get(args.contactId),
    ] as const);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Get account to check organization
    const account = await ctx.db.get(contact.accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    await Promise.all([
      requireAuthorizedOrganization(ctx, {
        organizationId: account.organizationId,
        moduleId: "accounts",
        permission: "accounts.delete",
      }),
      ctx.db.delete(args.contactId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "deleted_contact",
        entityType: "contact",
        entityId: args.contactId,
        changes: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          accountId: contact.accountId,
        },
      }),
    ] as const);

    return null;
  },
});

/**
 * Set a contact as the primary contact for an account
 */
export const setPrimary = mutation({
  args: {
    contactId: v.id("contacts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, contact] = await Promise.all([
      requireAuthenticatedUser(ctx),
      ctx.db.get(args.contactId),
    ] as const);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const account = await ctx.db.get(contact.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const [, existingPrimaryContacts] = await Promise.all([
      requireAuthorizedOrganization(ctx, {
        organizationId: account.organizationId,
        moduleId: "accounts",
        permission: "accounts.write",
      }),
      ctx.db
        .query("contacts")
        .withIndex("by_account", (q) => q.eq("accountId", contact.accountId))
        .collect(),
    ] as const);
    await Promise.all([
      Promise.all(
        Array.from(existingPrimaryContacts).map(async (existingContact) => {
          if (existingContact.isPrimary) {
            await ctx.db.patch(existingContact._id, {
              isPrimary: false,
              updatedAt: Date.now(),
            });
          }
        }),
      ),
      ctx.db.patch(args.contactId, {
        isPrimary: true,
        updatedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: account.organizationId,
        userId,
        action: "set_primary_contact",
        entityType: "contact",
        entityId: args.contactId,
        changes: {
          isPrimary: true,
          accountId: contact.accountId,
        },
      }),
    ] as const);

    return null;
  },
});
