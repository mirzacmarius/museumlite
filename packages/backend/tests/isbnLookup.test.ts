import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

type LibraryTestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
};

async function createLibraryTestSetup(
  t: ReturnType<typeof convexTest>,
): Promise<LibraryTestSetup> {
  return t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", {
      name: "Library Org",
      slug: `library-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "library",
      settings: { enabledModules: ["library"] },
    });
    const uid = await ctx.db.insert("users", {
      name: "Librarian",
      email: `librarian-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId: orgId,
      name: "Librarian",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId: uid,
      organizationId: orgId,
      roleId,
      joinedAt: Date.now(),
    });
    return { organizationId: orgId, userId: uid };
  });
}

describe("isbnLookup auth gate", () => {
  test("lookupIsbn throws Not authenticated for unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createLibraryTestSetup(t);

    await expect(
      t.action(api.library.isbnLookup.lookupIsbn, {
        organizationId,
        isbn: "9780140449136",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("validateIsbn throws Not authenticated for unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createLibraryTestSetup(t);

    await expect(
      t.action(api.library.isbnLookup.validateIsbn, {
        organizationId,
        isbn: "9780140449136",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("convertIsbn10To13 throws Not authenticated for unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createLibraryTestSetup(t);

    await expect(
      t.action(api.library.isbnLookup.convertIsbn10To13, {
        organizationId,
        isbn10: "0140449132",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("validateIsbn succeeds for authenticated org member", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createLibraryTestSetup(t);

    const authed = t.withIdentity({
      subject: `${userId}|session-isbn`,
      issuer: "https://example.test",
    });

    const result = await authed.action(api.library.isbnLookup.validateIsbn, {
      organizationId,
      isbn: "9780140449136",
    });

    expect(result.valid).toBe(true);
  });

  test("validateIsbn throws Not a member for non-member", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createLibraryTestSetup(t);

    const outsiderId = await t.run(async (ctx) => {
      return ctx.db.insert("users", {
        name: "Outsider",
        email: `outsider-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    });

    const authed = t.withIdentity({
      subject: `${outsiderId}|session-outsider`,
      issuer: "https://example.test",
    });

    await expect(
      authed.action(api.library.isbnLookup.validateIsbn, {
        organizationId,
        isbn: "9780140449136",
      }),
    ).rejects.toThrow("Not a member of this organization");
  });
});
