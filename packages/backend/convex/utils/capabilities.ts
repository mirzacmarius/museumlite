import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";
import {
  type FeatureId,
  getFeatureRequiredTier,
  hasFeatureTierAccess,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from "./featurePolicy";
import { MODULE_IDS, type ModuleId } from "./moduleCatalog";

/**
 * Staff-facing capabilities and the independent access dimensions that govern
 * them. Navigation, page guards and backend gates all read this matrix, so a
 * capability is visible exactly when its commands are allowed.
 */
export const CAPABILITY_IDS = [
  "loans",
  "transit",
  "exhibitions",
  "installations",
  "conservation",
  "insurance",
  "reporting",
  "compliance",
  "public_portal",
  "sites",
  "accounts",
  "patrons",
  "library",
  "documentation_quality",
  "deaccession",
  "reproduction_requests",
  "administration",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export interface CapabilityRequirement {
  /** Paid entitlement; the plan comes from `FEATURE_REQUIREMENTS`. */
  feature?: FeatureId;
  /** Free opt-in module an administrator turns on in Settings > Modules. */
  module?: ModuleId;
  /**
   * Module that only decides whether navigation lists the capability. Its
   * pages and commands do not require it.
   */
  listedWithModule?: ModuleId;
  /** Role permissions needed to open the canonical route. */
  permissions: readonly string[];
  /** Canonical route used by navigation and the command palette. */
  route: string;
}

export const CAPABILITY_MATRIX = {
  loans: { feature: "loans", permissions: ["loans.read"], route: "/loans" },
  transit: {
    feature: "loans",
    permissions: ["loans.read"],
    route: "/transit",
  },
  exhibitions: {
    feature: "exhibitions",
    permissions: ["collections.read"],
    route: "/exhibitions",
  },
  installations: {
    feature: "installations",
    permissions: ["collections.read"],
    route: "/installations",
  },
  conservation: {
    feature: "conservation",
    permissions: ["collections.read"],
    route: "/conservation",
  },
  // Policies predate the Insurance module (2026-09-20), so the module only
  // lists Insurance in navigation; enforcing it would cut off existing data.
  insurance: {
    feature: "loans",
    listedWithModule: "insurance",
    permissions: ["loans.read"],
    route: "/insurance",
  },
  // /analytics is an administration route (server layout gate).
  reporting: {
    feature: "reporting",
    permissions: ["organization.manage_settings"],
    route: "/analytics",
  },
  compliance: {
    feature: "compliance",
    permissions: [
      "organization.manage_settings",
      "organization.view_analytics",
    ],
    route: "/settings/activity",
  },
  public_portal: {
    feature: "public_portal",
    permissions: ["organization.manage_settings"],
    route: "/portal",
  },
  sites: {
    feature: "public_portal",
    permissions: ["organization.manage_settings", "sites.read"],
    route: "/settings/sites",
  },
  accounts: {
    module: "accounts",
    permissions: ["accounts.read", "organization.manage_settings"],
    route: "/accounts",
  },
  patrons: {
    module: "accounts",
    permissions: ["accounts.read"],
    route: "/accounts?type=patron",
  },
  library: {
    module: "library",
    permissions: ["collections.read"],
    route: "/library",
  },
  // Checks only read collection records; repairs happen in the records.
  documentation_quality: {
    permissions: ["collections.read", "collections.update"],
    route: "/documentation-quality",
  },
  // Starting a deaccession is a role rule, not one permission: see
  // `deaccessionInitiationState`, which single and bulk starts share.
  deaccession: {
    permissions: ["collections.read"],
    route: "/deaccessions",
  },
  // Requesters are Parties, so requests need the accounts module. Deciding
  // is the rights authority of public image approval (ADR 0014).
  reproduction_requests: {
    module: "accounts",
    permissions: ["media.read", "accounts.read"],
    route: "/reproduction-requests",
  },
  administration: {
    permissions: ["organization.manage_settings"],
    route: "/settings/organization",
  },
} as const satisfies Record<CapabilityId, CapabilityRequirement>;

export const CAPABILITY_UNAVAILABLE_REASONS = [
  "module_disabled",
  "tier_required",
  "permission_missing",
] as const;

export type CapabilityUnavailableReason =
  (typeof CAPABILITY_UNAVAILABLE_REASONS)[number];

// Type aliases (not interfaces) so the payload satisfies Convex's Value type.
type CapabilityStateBase = {
  capability: CapabilityId;
  /** False when navigation should not list the capability. */
  listed: boolean;
};

export type CapabilityState =
  | (CapabilityStateBase & { status: "available" })
  | (CapabilityStateBase & { status: "module_disabled"; module: ModuleId })
  | (CapabilityStateBase & {
      status: "tier_required";
      requiredTier: SubscriptionTier;
    })
  | (CapabilityStateBase & { status: "permission_missing" });

export interface OrganizationAccess {
  subscriptionTier?: SubscriptionTier | null;
  enabledModules?: ReadonlyArray<string>;
  enabledIntegrations?: ReadonlyArray<string>;
}

/** Library may also be on through the legacy library integration. */
export function isOrganizationModuleEnabled(
  access: OrganizationAccess,
  moduleId: ModuleId,
): boolean {
  if (access.enabledModules?.includes(moduleId)) return true;
  return (
    moduleId === "library" &&
    (access.enabledIntegrations?.includes("library") ?? false)
  );
}

function requirementOf(capability: CapabilityId): CapabilityRequirement {
  return CAPABILITY_MATRIX[capability];
}

/**
 * The first missing dimension is the reason: the module (an administrator's
 * choice), then the role (the member's access), then the plan. Members whose
 * role lacks access are never told to upgrade.
 *
 * `requiredPermissions` defaults to the capability's route permissions; a
 * command passes its own permission instead.
 */
export function evaluateCapability(
  capability: CapabilityId,
  access: OrganizationAccess,
  permissions: ReadonlyArray<string>,
  requiredPermissions: ReadonlyArray<string> = requirementOf(
    capability,
  ).permissions,
): CapabilityState {
  const requirement = requirementOf(capability);
  const listed =
    !requirement.listedWithModule ||
    isOrganizationModuleEnabled(access, requirement.listedWithModule);
  if (
    requirement.module &&
    !isOrganizationModuleEnabled(access, requirement.module)
  ) {
    return {
      capability,
      listed,
      status: "module_disabled",
      module: requirement.module,
    };
  }
  if (
    requiredPermissions.some((permission) => !permissions.includes(permission))
  ) {
    return { capability, listed, status: "permission_missing" };
  }
  if (
    requirement.feature &&
    !hasFeatureTierAccess(access.subscriptionTier, requirement.feature)
  ) {
    return {
      capability,
      listed,
      status: "tier_required",
      requiredTier: getFeatureRequiredTier(requirement.feature),
    };
  }
  return { capability, listed, status: "available" };
}

/** Module and plan only, for gates that check the permission separately. */
export function evaluateCapabilityEntitlement(
  capability: CapabilityId,
  access: OrganizationAccess,
): CapabilityState {
  return evaluateCapability(capability, access, [], []);
}

export function capabilityRoute(capability: CapabilityId): string {
  return requirementOf(capability).route;
}

export const CAPABILITY_UNAVAILABLE_CODE = "CAPABILITY_UNAVAILABLE";

export type CapabilityUnavailableData = {
  code: typeof CAPABILITY_UNAVAILABLE_CODE;
  reason: CapabilityUnavailableReason;
  /** English text for logs; clients translate from `reason`. */
  message: string;
  capability?: CapabilityId;
  requiredTier?: SubscriptionTier;
  module?: ModuleId;
};

/**
 * Coded, user-recoverable access failure. `message` keeps the legacy English
 * text so server-side callers that match on it keep working. Only throw it to
 * members of the organization: its data is not redacted for clients.
 */
export function capabilityUnavailable(
  details: Omit<CapabilityUnavailableData, "code">,
): ConvexError<CapabilityUnavailableData> {
  const data: CapabilityUnavailableData = {
    code: CAPABILITY_UNAVAILABLE_CODE,
    reason: details.reason,
    message: details.message,
  };
  if (details.capability !== undefined) data.capability = details.capability;
  if (details.requiredTier !== undefined)
    data.requiredTier = details.requiredTier;
  if (details.module !== undefined) data.module = details.module;
  const error = new ConvexError(data);
  error.message = details.message;
  return error;
}

export function permissionMissingMessage(permission: string) {
  return `Permission denied: ${permission}`;
}

export function moduleDisabledMessage(moduleId: string) {
  return `Module not enabled: ${moduleId}`;
}

export function tierRequiredMessage(tier: SubscriptionTier) {
  return `Feature requires ${tier} tier`;
}

/** The coded failure for an unavailable state; null when available. */
export function capabilityStateError(
  state: CapabilityState,
  permission: string,
): ConvexError<CapabilityUnavailableData> | null {
  switch (state.status) {
    case "available":
      return null;
    case "module_disabled":
      return capabilityUnavailable({
        reason: "module_disabled",
        capability: state.capability,
        module: state.module,
        message: moduleDisabledMessage(state.module),
      });
    case "tier_required":
      return capabilityUnavailable({
        reason: "tier_required",
        capability: state.capability,
        requiredTier: state.requiredTier,
        message: tierRequiredMessage(state.requiredTier),
      });
    case "permission_missing":
      return capabilityUnavailable({
        reason: "permission_missing",
        capability: state.capability,
        message: permissionMissingMessage(permission),
      });
  }
}

function oneOf<T extends string>(
  values: ReadonlyArray<T>,
  value: unknown,
): T | undefined {
  return values.find((candidate) => candidate === value);
}

/** Reads a capability failure from a thrown error; null for anything else. */
export function capabilityUnavailableFromError(
  error: unknown,
): CapabilityUnavailableData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.code !== CAPABILITY_UNAVAILABLE_CODE) return null;
  const reason = oneOf(CAPABILITY_UNAVAILABLE_REASONS, record.reason);
  if (!reason) return null;
  const result: CapabilityUnavailableData = {
    code: CAPABILITY_UNAVAILABLE_CODE,
    reason,
    message: typeof record.message === "string" ? record.message : reason,
  };
  const capability = oneOf(CAPABILITY_IDS, record.capability);
  if (capability) result.capability = capability;
  const requiredTier = oneOf(SUBSCRIPTION_TIERS, record.requiredTier);
  if (requiredTier) result.requiredTier = requiredTier;
  const moduleId = oneOf(MODULE_IDS, record.module);
  if (moduleId) result.module = moduleId;
  return result;
}
