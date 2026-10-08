import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserWithPermissions,
  type TestOrgUserOptions,
} from "./testHarness";

async function capabilityStates(
  permissions: string[],
  options: TestOrgUserOptions,
) {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    permissions,
    options,
  );
  return authedForUser(t, userId).query(api.capabilities.forOrganization, {
    organizationId,
  });
}

function stateOf(
  states: Awaited<ReturnType<typeof capabilityStates>>,
  capability: string,
) {
  return states?.find((state) => state.capability === capability);
}

async function enableLegacyLibraryIntegration(
  t: ConvexTest,
  organizationId: Id<"organizations">,
) {
  await t.run(async (ctx) => {
    await ctx.db.patch(organizationId, {
      settings: { enabledModules: [], enabledIntegrations: ["library"] },
    });
  });
}

describe("capabilities.forOrganization", () => {
  test("a free organization sees loans as requiring the Pro plan", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read"],
      { subscriptionTier: "free" },
    );

    const states = await authedForUser(t, userId).query(
      api.capabilities.forOrganization,
      { organizationId },
    );

    expect(states?.find((state) => state.capability === "loans")).toEqual({
      capability: "loans",
      status: "tier_required",
      requiredTier: "pro",
    });
  });

  test("a Pro organization without the insurance module sees insurance as module disabled", async () => {
    const states = await capabilityStates(["loans.read"], {
      subscriptionTier: "pro",
      enabledModules: [],
    });

    expect(stateOf(states, "insurance")).toEqual({
      capability: "insurance",
      status: "module_disabled",
      module: "insurance",
    });
  });

  test("insurance follows the loans plan once its module is on", async () => {
    const free = await capabilityStates(["loans.read"], {
      subscriptionTier: "free",
      enabledModules: ["insurance"],
    });
    const pro = await capabilityStates(["loans.read"], {
      subscriptionTier: "pro",
      enabledModules: ["insurance"],
    });

    expect(stateOf(free, "insurance")).toEqual({
      capability: "insurance",
      status: "tier_required",
      requiredTier: "pro",
    });
    expect(stateOf(pro, "insurance")).toEqual({
      capability: "insurance",
      status: "available",
    });
  });

  test("a module that is off is reported before a missing plan", async () => {
    const states = await capabilityStates([], { subscriptionTier: "free" });

    expect(stateOf(states, "insurance")?.status).toBe("module_disabled");
  });

  test("a Pro member whose role lacks loans.read sees loans as permission missing", async () => {
    const states = await capabilityStates(["collections.read"], {
      subscriptionTier: "pro",
    });

    expect(stateOf(states, "loans")).toEqual({
      capability: "loans",
      status: "permission_missing",
    });
    expect(stateOf(states, "exhibitions")).toEqual({
      capability: "exhibitions",
      status: "available",
    });
  });

  test("compliance requires Enterprise even for Pro administrators", async () => {
    const adminPermissions = [
      "organization.manage_settings",
      "organization.view_analytics",
    ];
    const pro = await capabilityStates(adminPermissions, {
      subscriptionTier: "pro",
    });
    const enterprise = await capabilityStates(adminPermissions, {
      subscriptionTier: "enterprise",
    });

    expect(stateOf(pro, "compliance")).toEqual({
      capability: "compliance",
      status: "tier_required",
      requiredTier: "enterprise",
    });
    expect(stateOf(enterprise, "compliance")?.status).toBe("available");
  });

  test("modules stay free: accounts and library depend only on the module and role", async () => {
    const states = await capabilityStates(
      ["accounts.read", "collections.read"],
      { subscriptionTier: "free", enabledModules: ["accounts", "library"] },
    );

    expect(stateOf(states, "patrons")?.status).toBe("available");
    expect(stateOf(states, "library")?.status).toBe("available");
    expect(stateOf(states, "accounts")).toEqual({
      capability: "accounts",
      status: "permission_missing",
    });
  });

  test("the legacy library integration still enables the library", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "collections.read",
    ]);
    await enableLegacyLibraryIntegration(t, organizationId);

    const states = await authedForUser(t, userId).query(
      api.capabilities.forOrganization,
      { organizationId },
    );

    expect(stateOf(states, "library")?.status).toBe("available");
  });

  test("non-members and signed-out callers learn nothing about the organization", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, [
      "loans.read",
    ]);
    const outsider = await createOrgUserWithPermissions(t, ["loans.read"]);

    await expect(
      authedForUser(t, outsider.userId).query(
        api.capabilities.forOrganization,
        { organizationId },
      ),
    ).resolves.toBeNull();
    await expect(
      t.query(api.capabilities.forOrganization, { organizationId }),
    ).resolves.toBeNull();
  });
});

describe("capability gates on commands", () => {
  test("listing loans on the free plan fails with a coded plan requirement", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read"],
      { subscriptionTier: "free" },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).query(api.loans.list, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "tier_required",
      capability: "loans",
      requiredTier: "pro",
    });
  });

  test("creating a loan without loans.create fails with a coded permission reason", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read"],
      { subscriptionTier: "pro" },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).mutation(api.loans.create, {
        organizationId,
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: Date.UTC(2026, 0, 1),
      }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "permission_missing",
      message: "Permission denied: loans.create",
    });
  });

  test("insurance policies are refused while the insurance module is off", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "pro", enabledModules: [] },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).query(api.insurance.listPolicies, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "module_disabled",
      module: "insurance",
    });
  });

  test("a free-plan administrator cannot create insurance policies", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "free", enabledModules: ["insurance"] },
    );
    const now = Date.UTC(2026, 0, 1);

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).mutation(api.insurance.createPolicy, {
        organizationId,
        policyNumber: "POL-FREE",
        carrier: "Carrier",
        policyType: "blanket",
        coverageAmount: 1_000,
        effectiveDate: now,
        expirationDate: now + 1,
      }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "tier_required",
      capability: "insurance",
      requiredTier: "pro",
    });
  });

  test("a Pro organization with the insurance module can create and list policies", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "pro", enabledModules: ["insurance"] },
    );
    const authed = authedForUser(t, userId);
    const now = Date.UTC(2026, 0, 1);

    await authed.mutation(api.insurance.createPolicy, {
      organizationId,
      policyNumber: "POL-PRO",
      carrier: "Carrier",
      policyType: "blanket",
      coverageAmount: 1_000,
      effectiveDate: now,
      expirationDate: now + 1,
    });
    const policies = await authed.query(api.insurance.listPolicies, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(policies.page.map((policy) => policy.policyNumber)).toEqual([
      "POL-PRO",
    ]);
  });

  test("outsiders are refused for their role, never told the organization's modules or plan", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "sites.read"],
      { subscriptionTier: "free", enabledModules: [] },
    );
    const outsider = await createOrgUserWithPermissions(
      t,
      ["loans.read", "sites.read", "organization.manage_settings"],
      { subscriptionTier: "enterprise", enabledModules: ["insurance"] },
    );
    const authed = authedForUser(t, outsider.userId);

    const insurance = await capabilityFailureOf(
      authed.query(api.insurance.listPolicies, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );
    const sites = await capabilityFailureOf(
      authed.query(api.sites.list, { organizationId }),
    );

    expect(insurance?.reason).toBe("permission_missing");
    expect(sites?.reason).toBe("permission_missing");
  });

  test("listing sites on the free plan fails with a coded plan requirement", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings", "sites.read"],
      { subscriptionTier: "free" },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).query(api.sites.list, { organizationId }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "tier_required",
      capability: "sites",
      requiredTier: "pro",
    });
  });

  test("accounts are refused with a coded module reason while the accounts module is off", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["accounts.read"],
      { subscriptionTier: "enterprise", enabledModules: [] },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).query(api.accounts.list, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "module_disabled",
      module: "accounts",
    });
  });
});
