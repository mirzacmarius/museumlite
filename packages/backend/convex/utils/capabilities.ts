import { ConvexError } from "convex/values";
import {
  type FeatureId,
  getFeatureRequiredTier,
  hasFeatureTierAccess,
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
  "administration",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export interface CapabilityRequirement {
  /** Paid entitlement; the plan comes from `FEATURE_REQUIREMENTS`. */
  feature?: FeatureId;
  /** Free opt-in module an administrator turns on in Settings > Modules. */
  module?: ModuleId;
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
  insurance: {
    module: "insurance",
    feature: "loans",
    permissions: ["loans.read"],
    route: "/insurance",
  },
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
export type CapabilityState =
  | { capability: CapabilityId; status: "available" }
  | { capability: CapabilityId; status: "module_disabled"; module: ModuleId }
  | {
      capability: CapabilityId;
      status: "tier_required";
      requiredTier: SubscriptionTier;
    }
  | { capability: CapabilityId; status: "permission_missing" };

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
 * Organization-level dimensions only (module, then plan). Role permissions are
 * checked separately because each command needs its own permission.
 */
export function evaluateCapabilityEntitlement(
  capability: CapabilityId,
  access: OrganizationAccess,
): CapabilityState {
  const requirement = requirementOf(capability);
  if (
    requirement.module &&
    !isOrganizationModuleEnabled(access, requirement.module)
  ) {
    return {
      capability,
      status: "module_disabled",
      module: requirement.module,
    };
  }
  if (
    requirement.feature &&
    !hasFeatureTierAccess(access.subscriptionTier, requirement.feature)
  ) {
    return {
      capability,
      status: "tier_required",
      requiredTier: getFeatureRequiredTier(requirement.feature),
    };
  }
  return { capability, status: "available" };
}

/** Module, then plan, then role: the first missing dimension is the reason. */
export function evaluateCapability(
  capability: CapabilityId,
  access: OrganizationAccess,
  permissions: ReadonlyArray<string>,
): CapabilityState {
  const entitlement = evaluateCapabilityEntitlement(capability, access);
  if (entitlement.status !== "available") return entitlement;
  const missingPermission = requirementOf(capability).permissions.some(
    (permission) => !permissions.includes(permission),
  );
  return missingPermission
    ? { capability, status: "permission_missing" }
    : entitlement;
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
 * text so server-side callers that match on it keep working.
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

function errorData(error: unknown): unknown {
  if (
    typeof error !== "object" ||
    error === null ||
    !(
      error instanceof ConvexError ||
      ("name" in error && error.name === "ConvexError")
    ) ||
    !("data" in error)
  ) {
    return undefined;
  }
  if (typeof error.data !== "string") return error.data;
  try {
    return JSON.parse(error.data);
  } catch {
    return undefined;
  }
}

function oneOf<T extends string>(
  values: ReadonlyArray<T>,
  value: unknown,
): T | undefined {
  return values.find((candidate) => candidate === value);
}

const TIERS: ReadonlyArray<SubscriptionTier> = ["free", "pro", "enterprise"];

/** Reads a capability failure from a thrown error; null for anything else. */
export function capabilityUnavailableFromError(
  error: unknown,
): CapabilityUnavailableData | null {
  const data = errorData(error);
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
  const requiredTier = oneOf(TIERS, record.requiredTier);
  if (requiredTier) result.requiredTier = requiredTier;
  const moduleId = oneOf(MODULE_IDS, record.module);
  if (moduleId) result.module = moduleId;
  return result;
}
