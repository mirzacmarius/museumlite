import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

type TestSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createTestSetup(
  t: ReturnType<typeof convexTest>,
): Promise<TestSetup> {
  const [organizationId, userId, manageSettingsPermissionId] =
    await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Test User",
          email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: "organization.manage_settings",
          category: "organization",
        });
      }),
    ]);
  const roleId = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });

    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: manageSettingsPermissionId,
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

describe("Webhook integrations", () => {
  test("should register webhook endpoint", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);
    const authed = authedForUser(t, userId, "session-create-webhook");

    const result = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Collection Events",
      url: "https://example.com/webhooks/collections",
      events: ["collection.created", "collection.updated"],
    });

    expect(result.id).toBeDefined();
    expect(result.secret).toMatch(/^whsec_[A-Za-z0-9]{32}$/);

    const webhooks = await authed.query(api.webhooks.list, { organizationId });
    expect(webhooks).toHaveLength(1);
    expect(webhooks[0]?._id).toBe(result.id);
    expect(webhooks[0]?.name).toBe("Collection Events");
    expect(webhooks[0]?.url).toBe("https://example.com/webhooks/collections");
    expect(webhooks[0]?.events).toEqual([
      "collection.created",
      "collection.updated",
    ]);
    expect(webhooks[0]?.isActive).toBe(true);
  });

  test("should get webhook with secret after registration", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);
    const authed = authedForUser(t, userId, "session-get-webhook");

    const { id, secret } = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Loan Events",
      url: "https://example.com/webhooks/loans",
      events: ["loan.created"],
    });

    const webhook = await authed.query(api.webhooks.get, { webhookId: id });

    expect(webhook).not.toBeNull();
    expect(webhook?.secret).toBe(secret);
    expect(webhook?.events).toEqual(["loan.created"]);
  });

  test("should update webhook event subscriptions", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);
    const authed = authedForUser(t, userId, "session-update-webhook");

    const { id } = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Media Events",
      url: "https://example.com/webhooks/media",
      events: ["media.uploaded"],
    });

    await authed.mutation(api.webhooks.update, {
      webhookId: id,
      events: ["media.uploaded", "accession.created", "accession.approved"],
      isActive: false,
    });

    const webhook = await authed.query(api.webhooks.get, { webhookId: id });
    expect(webhook?.events).toEqual([
      "media.uploaded",
      "accession.created",
      "accession.approved",
    ]);
    expect(webhook?.isActive).toBe(false);
  });

  test("should delete webhook", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);
    const authed = authedForUser(t, userId, "session-delete-webhook");

    const { id } = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Temporary Webhook",
      url: "https://example.com/webhooks/temp",
      events: ["loan.returned"],
    });

    await authed.mutation(api.webhooks.deleteWebhook, { webhookId: id });

    const webhooks = await authed.query(api.webhooks.list, { organizationId });
    expect(webhooks).toHaveLength(0);
    expect(await authed.query(api.webhooks.get, { webhookId: id })).toBeNull();
  });

  test("should reject unauthenticated webhook delivery test", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createTestSetup(t);
    const authed = authedForUser(t, userId, "session-deliver-webhook");

    const { id } = await authed.mutation(api.webhooks.create, {
      organizationId,
      name: "Delivery Test Webhook",
      url: "https://example.com/webhooks/delivery",
      events: ["collection.created"],
    });

    const result = await t.action(api.webhooksActions.test, { webhookId: id });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });
});

describe("integrations read security", () => {
  test("member can read enabled integrations", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: {
          enabledIntegrations: ["library"],
        },
      });
    });

    const enabled = await authed.query(api.integrations.getEnabled, {
      organizationId,
    });
    expect(enabled).toEqual(["library"]);

    const isLibraryEnabled = await authed.query(api.integrations.isEnabled, {
      organizationId,
      integrationId: "library",
    });
    expect(isLibraryEnabled).toBe(true);
  });

  test("unauthenticated caller cannot read enabled integrations", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, []);

    await expect(
      t.query(api.integrations.getEnabled, { organizationId }),
    ).rejects.toThrow("Not authenticated");

    await expect(
      t.query(api.integrations.isEnabled, {
        organizationId,
        integrationId: "library",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org integrations", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(t, []);
    const { userId: userB } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "other-org",
    });
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.integrations.getEnabled, { organizationId: orgA }),
    ).rejects.toThrow("Not a member of this organization");

    await expect(
      authedB.query(api.integrations.isEnabled, {
        organizationId: orgA,
        integrationId: "library",
      }),
    ).rejects.toThrow("Not a member of this organization");
  });
});
