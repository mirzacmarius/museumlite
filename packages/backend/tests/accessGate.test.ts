import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { capabilityOfPermission } from "../convex/utils/capabilities";
import type { OptInModuleId } from "../convex/utils/moduleCatalog";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserWithPermissions,
  type SubscriptionTier,
} from "./testHarness";

type Caller = ReturnType<typeof authedForUser>;

interface Organization {
  t: ConvexTest;
  organizationId: Id<"organizations">;
  loanId: Id<"loans">;
}

/** One command behind the gate, with the Permission it checks. */
interface GateCase {
  command: string;
  capability: string;
  permission: string;
  /** Permissions the command needs besides the one under test. */
  alongside?: string[];
  module?: OptInModuleId;
  requiredTier?: SubscriptionTier;
  call: (caller: Caller, org: Organization) => Promise<unknown>;
}

const page = { numItems: 10, cursor: null };

const GATE_CASES: GateCase[] = [
  {
    command: "loans.list",
    capability: "loans",
    permission: "loans.read",
    requiredTier: "pro",
    call: (caller, { organizationId }) =>
      caller.query(api.loans.list, { organizationId, paginationOpts: page }),
  },
  {
    command: "loans.create",
    capability: "loans",
    permission: "loans.create",
    requiredTier: "pro",
    call: (caller, { organizationId }) =>
      caller.mutation(api.loans.create, {
        organizationId,
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: Date.UTC(2026, 0, 1),
      }),
  },
  {
    command: "loans.update",
    capability: "loans",
    permission: "loans.update",
    requiredTier: "pro",
    call: (caller, { loanId }) =>
      caller.mutation(api.loans.update, { loanId, notes: "Updated" }),
  },
  {
    command: "loans.approve",
    capability: "loans",
    permission: "loans.approve",
    requiredTier: "pro",
    call: (caller, { loanId }) =>
      caller.mutation(api.loans.approve, { loanId }),
  },
  {
    command: "loans.listLoanDocuments",
    capability: "loans",
    permission: "loans.read",
    requiredTier: "pro",
    call: (caller, { loanId }) =>
      caller.query(api.loans.listLoanDocuments, { loanId }),
  },
  {
    command: "loans.listConditionDisputes",
    capability: "loans",
    permission: "loans.read",
    requiredTier: "pro",
    call: (caller, { organizationId }) =>
      caller.query(api.loans.listConditionDisputes, {
        organizationId,
        paginationOpts: page,
      }),
  },
  {
    command: "loanAgreementTemplates.create",
    capability: "loans",
    permission: "organization.manage_settings",
    requiredTier: "pro",
    call: (caller, { organizationId }) =>
      caller.mutation(api.loanAgreementTemplates.create, {
        organizationId,
        name: "Standard",
        language: "en",
        loanType: "any",
        sections: [],
      }),
  },
  {
    command: "reproductionRequests.list",
    capability: "reproduction_requests",
    permission: "accounts.read",
    alongside: ["media.read"],
    module: "accounts",
    call: (caller, { organizationId }) =>
      caller.query(api.reproductionRequests.list, {
        organizationId,
        paginationOpts: page,
      }),
  },
];

/** Every dimension open except the ones a scenario closes. */
async function organizationFor(
  gate: GateCase,
  options: {
    grantPermission: boolean;
    tier?: SubscriptionTier;
    moduleOn?: boolean;
  },
) {
  const t = createConvexTest();
  const permissions = [
    ...(gate.alongside ?? []),
    ...(options.grantPermission ? [gate.permission] : []),
  ];
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    permissions,
    {
      subscriptionTier: options.tier ?? "enterprise",
      enabledModules:
        gate.module && options.moduleOn !== false ? [gate.module] : [],
    },
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
  return { org: { t, organizationId, loanId }, userId };
}

describe.each(GATE_CASES)("access gate: $command", (gate) => {
  test.runIf(gate.module)(
    "a module that is off is the reason, before the role",
    async () => {
      const { org, userId } = await organizationFor(gate, {
        grantPermission: false,
        tier: "free",
        moduleOn: false,
      });

      const failure = await capabilityFailureOf(
        gate.call(authedForUser(org.t, userId), org),
      );

      expect(failure).toMatchObject({
        code: "CAPABILITY_UNAVAILABLE",
        reason: "module_disabled",
        capability: gate.capability,
        module: gate.module,
      });
    },
  );

  test("a missing Permission is the reason, before the plan", async () => {
    const { org, userId } = await organizationFor(gate, {
      grantPermission: false,
      tier: "free",
    });

    const failure = await capabilityFailureOf(
      gate.call(authedForUser(org.t, userId), org),
    );

    expect(failure).toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "permission_missing",
      capability: gate.capability,
      message: `Permission denied: ${gate.permission}`,
    });
  });

  test.runIf(gate.requiredTier)(
    "a missing Entitlement names the plan",
    async () => {
      const { org, userId } = await organizationFor(gate, {
        grantPermission: true,
        tier: "free",
      });

      const failure = await capabilityFailureOf(
        gate.call(authedForUser(org.t, userId), org),
      );

      expect(failure).toMatchObject({
        code: "CAPABILITY_UNAVAILABLE",
        reason: "tier_required",
        capability: gate.capability,
        requiredTier: gate.requiredTier,
      });
    },
  );

  test("a non-member gets the uncoded refusal", async () => {
    const { org } = await organizationFor(gate, {
      grantPermission: false,
      tier: "free",
      moduleOn: false,
    });
    const outsider = await createOrgUserWithPermissions(
      org.t,
      [...(gate.alongside ?? []), gate.permission],
      {
        subscriptionTier: "enterprise",
        enabledModules: gate.module ? [gate.module] : [],
      },
    );

    for (const caller of [authedForUser(org.t, outsider.userId), org.t]) {
      let thrown: unknown;
      try {
        await gate.call(caller, org);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(await capabilityFailureOf(Promise.reject(thrown))).toBeNull();
    }
  });
});

describe("Permission ownership", () => {
  test("every loans Permission belongs to Loans", () => {
    for (const permission of [
      "loans.read",
      "loans.create",
      "loans.update",
      "loans.delete",
      "loans.approve",
      "loans.view_admin_overview",
      "loans.view_transport",
    ]) {
      expect(capabilityOfPermission(permission)).toBe("loans");
    }
  });

  test("approval Permissions belong to their Capability", () => {
    expect(capabilityOfPermission("collections.approve_exhibition")).toBe(
      "exhibitions",
    );
    expect(capabilityOfPermission("collections.approve_conservation")).toBe(
      "conservation",
    );
    expect(capabilityOfPermission("collections.read")).toBeNull();
  });
});
