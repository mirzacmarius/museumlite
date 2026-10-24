import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import {
  MAX_ADDRESS_LINE_LENGTH,
  MAX_PHONE_LENGTH,
  organizationContactErrorFromError,
} from "../convex/utils/organizationContact";
import {
  accessionFormatRefusalOf,
  authedForUser,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserWithPermissions,
  rebuildProjection,
} from "./testHarness";
import { modules } from "./testSetup";

describe("organizations.setModuleEnabled", () => {
  test("the Library module turns on only once the library integration is on", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const admin = authedForUser(t, userId);
    const enableLibrary = () =>
      admin.mutation(api.organizations.setModuleEnabled, {
        organizationId,
        moduleId: "library",
        enabled: true,
      });

    expect(await capabilityFailureOf(enableLibrary())).toMatchObject({
      reason: "module_disabled",
    });

    await t.run((ctx) =>
      ctx.db.patch(organizationId, {
        settings: { enabledIntegrations: ["library"] },
      }),
    );
    await enableLibrary();
    const organization = await admin.query(api.organizations.get, {
      organizationId,
    });
    expect(organization?.settings?.enabledModules).toEqual(["library"]);
  });
});

describe("organizations.get security (IDOR fix)", () => {
  test("member can read their own org", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
    );
    const authed = authedForUser(t, userId);

    const org = await authed.query(api.organizations.get, { organizationId });

    expect(org).not.toBeNull();
    expect(org?._id).toBe(organizationId);
  });

  test("unauthenticated caller cannot read org", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, []);

    await expect(
      t.query(api.organizations.get, { organizationId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(t, []);
    const { userId: userB } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "other-org",
    });
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.organizations.get, { organizationId: orgA }),
    ).rejects.toThrow("Not a member of this organization");
  });
});

describe("organizations.getPortalSettings security", () => {
  test("member can read portal settings", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: {
          portalSettings: {
            isEnabled: true,
            isSearchEnabled: true,
            portalSlug: "catalog",
          },
        },
      });
    });

    const settings = await authed.query(api.organizations.getPortalSettings, {
      organizationId,
    });

    expect(settings.isEnabled).toBe(true);
    expect(settings.isSearchEnabled).toBe(true);
    expect(settings.portalSlug).toBe("catalog");
  });

  test("unauthenticated caller cannot read portal settings", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, []);

    await expect(
      t.query(api.organizations.getPortalSettings, { organizationId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org portal settings", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(t, []);
    const { userId: userB } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "other-org",
    });
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.organizations.getPortalSettings, {
        organizationId: orgA,
      }),
    ).rejects.toThrow("Not a member of this organization");
  });
});

describe("organization hierarchy", () => {
  async function createUser(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Hierarchy Admin",
        email: `hierarchy-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
  }

  test("pro parent can create and list child organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const parentOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Parent Museum",
        slug: `parent-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      },
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(parentOrganizationId, {
        subscriptionTier: "pro",
      });
    });

    const childOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Child Museum",
        slug: `child-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId,
      },
    );

    const [childOrganization, children] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(childOrganizationId);
      }),
      authed.query(api.organizations.listChildOrganizations, {
        organizationId: parentOrganizationId,
      }),
    ]);
    expect(childOrganization?.parentOrganizationId).toBe(parentOrganizationId);
    expect(childOrganization?.rootOrganizationId).toBe(parentOrganizationId);
    expect(children.some((child) => child._id === childOrganizationId)).toBe(
      true,
    );
  });

  test("free parent cannot create child organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const parentOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Free Parent Museum",
        slug: `free-parent-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      },
    );

    await expect(
      authed.mutation(api.organizations.create, {
        name: "Blocked Child Museum",
        slug: `blocked-child-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId,
      }),
    ).rejects.toThrow("Pro or Enterprise");
  });
});

describe("getUsageStats", () => {
  test("reports object and storage usage as unavailable until the projection is built, then from source rows rather than a stale counter", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "counter-org" },
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("organizationUsageCounters", {
        organizationId,
        objectCount: 17,
        mediaFileCount: 4,
        mediaVersionCount: 2,
        storageBytes: 8192,
        mediaByType: {
          image: {
            count: 4,
            bytes: 8192,
          },
        },
        lastUpdatedAt: Date.now(),
      });

      await ctx.db.insert("exportUsage", {
        organizationId,
        periodStart: Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          1,
        ),
        count: 3,
      });
      for (const accessionNumber of ["U-1", "U-2"]) {
        await ctx.db.insert("collections", {
          organizationId,
          accessionNumber,
          title: accessionNumber,
          status: "active",
          catalogedBy: userId,
          catalogedAt: 1,
        });
      }
    });

    const before = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });
    expect(before.metrics).toEqual({
      availability: "unavailable",
      reason: "not_built",
      definitionVersion: 3,
    });
    expect(before.objects.used).toBeNull();
    expect(before.storage.used).toBeNull();
    expect(before.exports.used).toBe(3);

    await rebuildProjection(t, organizationId);
    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.metrics).toEqual({ availability: "ready", updating: false });
    expect(stats.objects.used).toBe(2);
    expect(stats.storage.used).toBe(0);
    expect(stats.exports.used).toBe(3);
  });

  test("should return correct structure for free tier", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "test-org" },
    );
    const authed = authedForUser(t, userId);

    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats).toBeDefined();
    expect(stats.tier).toBe("free");
    expect(stats.storage).toHaveProperty("used");
    expect(stats.storage).toHaveProperty("limit");
    expect(stats.objects).toHaveProperty("used");
    expect(stats.objects).toHaveProperty("limit");
    expect(stats.exports).toHaveProperty("used");
    expect(stats.exports).toHaveProperty("limit");
  });

  test("should count objects correctly", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "test-org-pro" },
    );
    const authed = authedForUser(t, userId);

    await rebuildProjection(t, organizationId);
    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.objects.used).toBe(0);
  });

  test("should sum storage correctly", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "test-org-storage" },
    );
    const authed = authedForUser(t, userId);

    await rebuildProjection(t, organizationId);
    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.storage.used).toBe(0);
  });

  test("should handle enterprise tier with null limits", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      {
        slugPrefix: "enterprise-org",
        subscriptionTier: "enterprise",
      },
    );
    const authed = authedForUser(t, userId);

    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.tier).toBe("enterprise");
    expect(stats.storage.limit).toBeNull();
    expect(stats.objects.limit).toBeNull();
    expect(stats.exports.limit).toBeNull();
  });
});

describe("organization read helpers security", () => {
  test("unauthenticated callers cannot read settings, usage, or user list", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "secured-org",
    });

    await expect(
      t.query(api.organizations.getSettings, { organizationId }),
    ).rejects.toThrow("Not authenticated");
    await expect(
      t.query(api.organizations.getUsageStats, { organizationId }),
    ).rejects.toThrow("Not authenticated");
    await expect(
      t.query(api.organizations.listOrganizationUsers, { organizationId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org's settings, usage, or user list", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { slugPrefix: "org-a" },
    );
    const { userId: userB } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { slugPrefix: "org-b" },
    );
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.organizations.getSettings, { organizationId: orgA }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
    await expect(
      authedB.query(api.organizations.getUsageStats, { organizationId: orgA }),
    ).rejects.toThrow("Not a member of this organization");
    await expect(
      authedB.query(api.organizations.listOrganizationUsers, {
        organizationId: orgA,
      }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
  });

  test("authorized org admin can read settings, usage, and user list", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      {
        slugPrefix: "admin-org",
        organizationName: "Admin Museum",
      },
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: {
          autoGenerateAccessionNumbers: true,
        },
      });
    });

    const [settings, stats, users] = await Promise.all([
      authed.query(api.organizations.getSettings, { organizationId }),
      authed.query(api.organizations.getUsageStats, { organizationId }),
      authed.query(api.organizations.listOrganizationUsers, { organizationId }),
    ]);

    expect(settings?.autoGenerateAccessionNumbers).toBe(true);
    expect(stats.tier).toBe("free");
    expect(users.some((user) => user._id === userId)).toBe(true);
  });

  test("org member without manage_settings can read usage stats", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "member-usage-org" },
    );
    const authed = authedForUser(t, userId);

    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.tier).toBe("free");
  });

  test("org member without manage_settings cannot list organization users", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "member-users-org" },
    );
    const authed = authedForUser(t, userId);

    await expect(
      authed.query(api.organizations.listOrganizationUsers, { organizationId }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
  });
});

describe("watermark settings", () => {
  test("should update watermark settings", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-watermark-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Admin User",
          email: "admin@test.com",
        });
      }),
    ]);
    // Create admin role with permission
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
          name: "organization.manage_settings",
          category: "organization",
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

    // Update watermark settings
    const authed = authedForUser(t, userId);
    await authed.mutation(api.organizations.updateWatermarkSettings, {
      organizationId: orgId,
      watermarkSettings: {
        isEnabled: true,
        text: "© 2026 Test Museum",
        opacity: 0.7,
        position: "bottom-right",
      },
    });

    // Verify settings were saved
    const org = await t.run(async (ctx) => {
      return await ctx.db.get(orgId);
    });

    expect(org?.settings?.watermarkSettings).toBeDefined();
    expect(org?.settings?.watermarkSettings?.isEnabled).toBe(true);
    expect(org?.settings?.watermarkSettings?.text).toBe("© 2026 Test Museum");
    expect(org?.settings?.watermarkSettings?.opacity).toBe(0.7);
    expect(org?.settings?.watermarkSettings?.position).toBe("bottom-right");
  });
});

describe("rights defaults", () => {
  const inCopyright = "http://rightsstatements.org/vocab/InC/1.0/";
  const ccBy = "https://creativecommons.org/licenses/by/4.0/";

  test("an administrator sets, keeps and removes each default, and the Organization reads them back", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    await t.run((ctx) =>
      ctx.db.patch(organizationId, {
        settings: { accessionWorkflowEnabled: false },
      }),
    );
    const admin = authedForUser(t, userId);
    const update = (rightsDefaults: {
      objectRightsStatement?: typeof inCopyright | null;
      mediaRightsStatement?: typeof ccBy | null;
    }) =>
      admin.mutation(api.organizations.updateRightsDefaults, {
        organizationId,
        rightsDefaults,
      });

    await update({
      objectRightsStatement: inCopyright,
      mediaRightsStatement: ccBy,
    });
    expect(
      (await admin.query(api.organizations.get, { organizationId }))?.settings,
    ).toMatchObject({
      accessionWorkflowEnabled: false,
      rightsDefaults: {
        objectRightsStatement: inCopyright,
        mediaRightsStatement: ccBy,
      },
    });
    expect(
      (await admin.query(api.organizations.getSettings, { organizationId }))
        ?.rightsDefaults,
    ).toEqual({
      objectRightsStatement: inCopyright,
      mediaRightsStatement: ccBy,
    });
    const [membership] = await admin.query(
      api.organizations.listUserOrganizations,
      {},
    );
    expect(membership?.settings?.rightsDefaults).toEqual({
      objectRightsStatement: inCopyright,
      mediaRightsStatement: ccBy,
    });

    // A default left out keeps its value; null removes it.
    await update({ mediaRightsStatement: null });
    const stored = await t.run((ctx) => ctx.db.get(organizationId));
    expect(stored?.settings?.rightsDefaults).toEqual({
      objectRightsStatement: inCopyright,
    });
    expect(stored?.settings?.accessionWorkflowEnabled).toBe(false);

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("action"), "updated_rights_defaults"))
        .collect(),
    );
    expect(audit).toHaveLength(2);
    expect(audit[1]).toMatchObject({
      organizationId,
      entityType: "organization",
      entityId: organizationId,
    });
  });

  test("a member without the settings permission, or a statement not on the list, changes nothing", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "organization.manage_settings",
    ]);
    const admin = authedForUser(t, userId);
    const readerId = await t.run(async (ctx) => {
      const readerId = await ctx.db.insert("users", {
        name: "Reader",
        email: "reader@example.com",
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Reader",
        isSystemRole: false,
      });
      await ctx.db.insert("userOrganizations", {
        userId: readerId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      return readerId;
    });
    const reader = authedForUser(t, readerId);

    expect(
      await capabilityFailureOf(
        reader.mutation(api.organizations.updateRightsDefaults, {
          organizationId,
          rightsDefaults: { objectRightsStatement: inCopyright },
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    const unlisted = {
      organizationId,
      rightsDefaults: {
        objectRightsStatement: "https://creativecommons.org/licenses/by/3.0/",
      },
    };
    await expect(
      admin.mutation(
        api.organizations.updateRightsDefaults,
        unlisted as unknown as FunctionArgs<
          typeof api.organizations.updateRightsDefaults
        >,
      ),
    ).rejects.toThrow(/Validator error/);
    expect(
      (await t.run((ctx) => ctx.db.get(organizationId)))?.settings
        ?.rightsDefaults,
    ).toBeUndefined();
  });
});

describe("organizations.getAccessionNumberPreview", () => {
  test("formats the next number from the supplied timestamp", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "collections.read",
    ]);
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: { accessionNumberFormat: "{YYYY}.{####}" },
      });
    });
    const now = Date.UTC(2026, 5, 15, 12);
    const preview = await authedForUser(t, userId).query(
      api.organizations.getAccessionNumberPreview,
      { organizationId, now },
    );
    expect(preview).toEqual({
      preview: "2026.0001",
      nextNumber: "2026.0001",
      template: "{YYYY}.{####}",
      scope: "year",
    });
  });
});

describe("saving the accession number format", () => {
  async function setupStoredFormat(accessionNumberFormat: string) {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [
        "organization.manage_settings",
        "collections.create",
        "collections.read",
        "collections.update",
      ],
      { subscriptionTier: "pro" },
    );
    await t.run((ctx) =>
      ctx.db.patch(organizationId, {
        settings: { autoGenerateAccessionNumbers: true, accessionNumberFormat },
      }),
    );
    return { t, organizationId, admin: authedForUser(t, userId) };
  }

  /**
   * Older Preferences clients and direct API callers send every setting, the
   * untouched format included.
   */
  function preferences(accessionNumberFormat: string) {
    return {
      accessionNumberFormat,
      accessionCounterScope: "year" as const,
      autoGenerateAccessionNumbers: true,
      locationTrackingEnabled: false,
    };
  }

  async function storedSettings(
    t: ReturnType<typeof createConvexTest>,
    organizationId: Id<"organizations">,
  ) {
    return (await t.run((ctx) => ctx.db.get(organizationId)))?.settings;
  }

  test("saving other preferences keeps a stored bare-token format, which then numbers objects", async () => {
    const { t, organizationId, admin } =
      await setupStoredFormat("NAT-YYYY-###");

    await admin.mutation(api.organizations.update, {
      organizationId,
      settings: preferences("NAT-YYYY-###"),
    });

    const settings = await storedSettings(t, organizationId);
    expect(settings?.accessionNumberFormat).toBe("NAT-YYYY-###");
    expect(settings?.locationTrackingEnabled).toBe(false);
    const objectId = await admin.mutation(api.collections.create, {
      organizationId,
      title: "Generated",
    });
    const object = await t.run((ctx) => ctx.db.get(objectId));
    expect(object?.accessionNumber).toBe(`NAT-${new Date().getFullYear()}-001`);
  });

  test("an unchanged stored format without a counter does not block saving other preferences", async () => {
    const { t, organizationId, admin } = await setupStoredFormat("OBJ-0001");

    await admin.mutation(api.organizations.update, {
      organizationId,
      settings: preferences("OBJ-0001"),
    });

    const settings = await storedSettings(t, organizationId);
    expect(settings?.accessionNumberFormat).toBe("OBJ-0001");
    expect(settings?.locationTrackingEnabled).toBe(false);
  });

  test("a new format without a counter is refused with a coded error and nothing is saved", async () => {
    const { t, organizationId, admin } =
      await setupStoredFormat("NAT-YYYY-###");

    const refusal = await accessionFormatRefusalOf(
      admin.mutation(api.organizations.update, {
        organizationId,
        settings: preferences("NAT-{YYYY}"),
      }),
    );

    expect(refusal).toMatchObject({
      code: "ACCESSION_FORMAT_INVALID",
      issues: [{ code: "COUNTER_MISSING" }],
    });
    const settings = await storedSettings(t, organizationId);
    expect(settings?.accessionNumberFormat).toBe("NAT-YYYY-###");
    expect(settings?.locationTrackingEnabled).toBeUndefined();
  });

  test.each([
    "{ORG:3}-{YYYY}-{####}",
    "NAT-{YYYY}-{###}",
  ])("a new format in the braced syntax, %s, is saved", async (format) => {
    const { t, organizationId, admin } =
      await setupStoredFormat("NAT-YYYY-###");

    await admin.mutation(api.organizations.update, {
      organizationId,
      settings: preferences(format),
    });

    expect(
      (await storedSettings(t, organizationId))?.accessionNumberFormat,
    ).toBe(format);
  });

  test.each([
    "HER-YYYY-####",
    "MUS-YYYY-MM-####",
  ])("a new format written with bare tokens, %s, is refused", async (format) => {
    const { t, organizationId, admin } =
      await setupStoredFormat("NAT-YYYY-###");

    const refusal = await accessionFormatRefusalOf(
      admin.mutation(api.organizations.update, {
        organizationId,
        settings: preferences(format),
      }),
    );

    expect(refusal?.issues).toEqual([{ code: "COUNTER_MISSING" }]);
    expect(
      (await storedSettings(t, organizationId))?.accessionNumberFormat,
    ).toBe("NAT-YYYY-###");
  });

  test("clearing the format is refused rather than silently keeping it", async () => {
    const { t, organizationId, admin } =
      await setupStoredFormat("NAT-YYYY-###");

    const refusal = await accessionFormatRefusalOf(
      admin.mutation(api.organizations.update, {
        organizationId,
        settings: preferences(""),
      }),
    );

    expect(refusal?.issues).toEqual([{ code: "FORMAT_EMPTY" }]);
    expect(
      (await storedSettings(t, organizationId))?.accessionNumberFormat,
    ).toBe("NAT-YYYY-###");
  });

  test("the format-only mutation refuses a format without a counter", async () => {
    const { t, organizationId, admin } =
      await setupStoredFormat("NAT-YYYY-###");

    const refusal = await accessionFormatRefusalOf(
      admin.mutation(api.organizations.updateAccessionNumberFormat, {
        organizationId,
        format: "NAT-0001",
        autoGenerate: true,
      }),
    );

    expect(refusal?.issues).toEqual([{ code: "COUNTER_MISSING" }]);
    expect(
      (await storedSettings(t, organizationId))?.accessionNumberFormat,
    ).toBe("NAT-YYYY-###");
  });

  test("validation reports coded issues for the form to translate", async () => {
    const t = createConvexTest();

    const [stored, edited, unknown] = await Promise.all([
      t.query(api.organizations.validateAccessionFormat, {
        template: "NAT-YYYY-###",
        organizationSlug: "natural-history-museum",
        stored: true,
      }),
      t.query(api.organizations.validateAccessionFormat, {
        template: "NAT-YYYY-###",
        organizationSlug: "natural-history-museum",
      }),
      t.query(api.organizations.validateAccessionFormat, {
        template: "NAT-{YYYY}-{XYZ}",
        organizationSlug: "natural-history-museum",
      }),
    ]);

    expect(stored).toMatchObject({
      isValid: true,
      issues: [],
      preview: `NAT-${new Date().getFullYear()}-001`,
    });
    expect(edited).toMatchObject({
      isValid: false,
      issues: [{ code: "COUNTER_MISSING" }],
    });
    expect(unknown).toMatchObject({
      isValid: false,
      issues: [
        { code: "UNKNOWN_VARIABLE", variable: "{XYZ}" },
        { code: "COUNTER_MISSING" },
      ],
    });
  });

  test("seeded organizations get a format in the braced syntax", async () => {
    const t = createConvexTest();

    const organizationId = await t.mutation(
      internal.seedMet.createOrganization,
      {
        name: "National Museum of Natural History",
        slug: "natural-history-museum",
        type: "museum",
        subscriptionTier: "enterprise",
      },
    );

    expect(
      (await storedSettings(t, organizationId))?.accessionNumberFormat,
    ).toBe("NAT-{YYYY}-{###}");
  });
});

describe("organization address and phone", () => {
  async function setup(permissionNames = ["organization.manage_settings"]) {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      permissionNames,
    );
    const caller = authedForUser(t, userId);
    const stored = () =>
      caller.query(api.organizations.get, { organizationId });
    return { organizationId, caller, stored };
  }

  test("saves trimmed lines without the blank ones, keeps them when only the name changes, and a blank form removes them", async () => {
    const { organizationId, caller, stored } = await setup();

    await caller.mutation(api.organizations.update, {
      organizationId,
      address: {
        street: "  Strandgata 12 ",
        street2: " ",
        postalCode: "6413",
        city: "Molde",
        region: "",
        country: "Norge",
      },
      phone: " +47 71 20 00 00 ",
    });
    expect(await stored()).toMatchObject({
      address: {
        street: "Strandgata 12",
        postalCode: "6413",
        city: "Molde",
        country: "Norge",
      },
      phone: "+47 71 20 00 00",
    });
    expect((await stored())?.address).not.toHaveProperty("street2");

    await caller.mutation(api.organizations.update, {
      organizationId,
      name: "Romsdal Museum",
    });
    expect(await stored()).toMatchObject({
      name: "Romsdal Museum",
      address: { city: "Molde" },
      phone: "+47 71 20 00 00",
    });

    await caller.mutation(api.organizations.update, {
      organizationId,
      address: { street: "", city: "  ", country: "" },
      phone: " ",
    });
    const cleared = await stored();
    expect(cleared).not.toHaveProperty("address");
    expect(cleared).not.toHaveProperty("phone");
  });

  test.each([
    {
      field: "city",
      limit: MAX_ADDRESS_LINE_LENGTH,
      change: { address: { city: "x".repeat(MAX_ADDRESS_LINE_LENGTH + 1) } },
    },
    {
      field: "phone",
      limit: MAX_PHONE_LENGTH,
      change: { phone: "1".repeat(MAX_PHONE_LENGTH + 1) },
    },
  ])("a $field over $limit characters is refused with a coded error and nothing is saved", async ({
    field,
    limit,
    change,
  }) => {
    const { organizationId, caller, stored } = await setup();

    const refusal = await caller
      .mutation(api.organizations.update, {
        organizationId,
        name: "Renamed",
        ...change,
      })
      .then(
        () => null,
        (error: unknown) => organizationContactErrorFromError(error),
      );

    expect(refusal).toMatchObject({
      code: "CONTACT_FIELD_TOO_LONG",
      field,
      limit,
    });
    const organization = await stored();
    expect(organization?.name).toBe("Test Museum");
    expect(organization).not.toHaveProperty("address");
    expect(organization).not.toHaveProperty("phone");
  });

  test("a member without organization.manage_settings cannot change them", async () => {
    const { organizationId, caller, stored } = await setup([]);

    const failure = await capabilityFailureOf(
      caller.mutation(api.organizations.update, {
        organizationId,
        phone: "+47 71 20 00 00",
      }),
    );

    expect(failure).toMatchObject({ reason: "permission_missing" });
    expect(await stored()).not.toHaveProperty("phone");
  });
});
