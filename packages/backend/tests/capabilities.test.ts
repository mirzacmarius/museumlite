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

const policyArgs = (organizationId: Id<"organizations">, number: string) => ({
  organizationId,
  policyNumber: number,
  carrier: "Carrier",
  policyType: "blanket" as const,
  coverageAmount: 1_000,
  currency: "USD",
  effectiveDate: Date.UTC(2026, 0, 1),
  expirationDate: Date.UTC(2027, 0, 1),
});

describe("capabilities.forOrganization", () => {
  test("a free organization sees loans as requiring the Pro plan", async () => {
    const states = await capabilityStates(["loans.read"], {
      subscriptionTier: "free",
    });

    expect(stateOf(states, "loans")).toEqual({
      capability: "loans",
      listed: true,
      status: "tier_required",
      requiredTier: "pro",
    });
  });

  test("insurance follows the loans plan, and its module only lists it in navigation", async () => {
    const withoutModule = await capabilityStates(["loans.read"], {
      subscriptionTier: "pro",
      enabledModules: [],
    });
    const withModule = await capabilityStates(["loans.read"], {
      subscriptionTier: "pro",
      enabledModules: ["insurance"],
    });
    const freeWithModule = await capabilityStates(["loans.read"], {
      subscriptionTier: "free",
      enabledModules: ["insurance"],
    });

    expect(stateOf(withoutModule, "insurance")).toEqual({
      capability: "insurance",
      listed: false,
      status: "available",
    });
    expect(stateOf(withModule, "insurance")).toEqual({
      capability: "insurance",
      listed: true,
      status: "available",
    });
    expect(stateOf(freeWithModule, "insurance")).toEqual({
      capability: "insurance",
      listed: true,
      status: "tier_required",
      requiredTier: "pro",
    });
  });

  test("a module that is off is reported before a missing role permission", async () => {
    const states = await capabilityStates([], { subscriptionTier: "free" });

    expect(stateOf(states, "accounts")).toEqual({
      capability: "accounts",
      listed: true,
      status: "module_disabled",
      module: "accounts",
    });
  });

  test("a member whose role lacks access is never told to upgrade", async () => {
    const free = await capabilityStates([], { subscriptionTier: "free" });
    const pro = await capabilityStates(["collections.read"], {
      subscriptionTier: "pro",
    });

    expect(stateOf(free, "exhibitions")?.status).toBe("permission_missing");
    expect(stateOf(pro, "loans")?.status).toBe("permission_missing");
    expect(stateOf(pro, "exhibitions")?.status).toBe("available");
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

    expect(stateOf(pro, "compliance")).toMatchObject({
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
    expect(stateOf(states, "accounts")?.status).toBe("permission_missing");
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
  test("a Pro organization keeps insurance without its module, since policies predate it", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "pro", enabledModules: [] },
    );
    const authed = authedForUser(t, userId);

    await authed.mutation(
      api.insurance.createPolicy,
      policyArgs(organizationId, "POL-PRO"),
    );
    const policies = await authed.query(api.insurance.listPolicies, {
      organizationId,
      now: Date.UTC(2026, 6, 1),
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(policies.page.map((policy) => policy.policyNumber)).toEqual([
      "POL-PRO",
    ]);
  });

  test("a free-plan administrator cannot create insurance policies", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "free", enabledModules: ["insurance"] },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).mutation(
        api.insurance.createPolicy,
        policyArgs(organizationId, "POL-FREE"),
      ),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "tier_required",
      capability: "insurance",
      requiredTier: "pro",
    });
  });

  test("a free-plan administrator cannot read the legacy coverage review queue", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "organization.manage_settings"],
      { subscriptionTier: "free", enabledModules: ["insurance"] },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).query(api.insuranceCoverageReviews.list, {
        organizationId,
      }),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "tier_required",
      capability: "insurance",
    });
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

  test("a free-plan loan assignment without loans.update names the role, not the plan", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["collections.read"],
      { subscriptionTier: "free" },
    );
    const loanId = await t.run((ctx) =>
      ctx.db.insert("loans", {
        organizationId,
        loanNumber: "LOAN-1",
        type: "outgoing",
        lenderBorrowerName: "Borrowing Museum",
        startDate: Date.UTC(2026, 0, 1),
        status: "pending",
      }),
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).mutation(api.workflows.assignLoan, {
        loanId,
        userId,
      }),
    );

    expect(failure).toMatchObject({
      reason: "permission_missing",
      message: "Permission denied: loans.update",
    });
  });

  test("a free-plan site change without its permission names the role, not the plan", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { subscriptionTier: "free" },
    );

    const failure = await capabilityFailureOf(
      authedForUser(t, userId).mutation(api.sites.create, {
        organizationId,
        name: "Annex",
      }),
    );

    expect(failure).toMatchObject({
      reason: "permission_missing",
      message: "Permission denied: sites.create",
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

  test("outsiders never receive an organization's modules or plan", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(
      t,
      ["loans.read", "sites.read", "accounts.read"],
      { subscriptionTier: "free", enabledModules: [] },
    );
    const outsider = await createOrgUserWithPermissions(
      t,
      ["loans.read", "sites.read", "accounts.read"],
      { subscriptionTier: "enterprise", enabledModules: ["accounts"] },
    );
    const callers = [authedForUser(t, outsider.userId), t];
    const page = { numItems: 10, cursor: null };

    for (const caller of callers) {
      const failures = await Promise.all([
        capabilityFailureOf(
          caller.query(api.loans.list, {
            organizationId,
            paginationOpts: page,
          }),
        ),
        capabilityFailureOf(
          caller.query(api.accounts.list, {
            organizationId,
            paginationOpts: page,
          }),
        ),
        capabilityFailureOf(
          caller.query(api.insurance.listPolicies, {
            organizationId,
            paginationOpts: page,
          }),
        ),
        capabilityFailureOf(caller.query(api.sites.list, { organizationId })),
      ]);

      for (const failure of failures) {
        expect(failure?.requiredTier).toBeUndefined();
        expect(failure?.module).toBeUndefined();
        expect(failure?.reason ?? "uncoded").not.toBe("tier_required");
      }
    }
  });
});
