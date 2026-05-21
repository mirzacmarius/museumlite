import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getNextCounterPreview } from "./utils/accessionCounter";
import {
  AccessionNumberParser,
  accessionParser,
} from "./utils/accessionNumberParser";
import {
  enforceUserQuota,
  getTierLimits,
  requireFeatureAccess,
  type SubscriptionTier,
} from "./utils/featureGates";
import type { ModuleId } from "./utils/moduleCatalog";
import { enabledModuleValidator } from "./utils/moduleValidators";
import {
  createEmptyUsageCounter,
  getUsageCounter,
} from "./utils/organizationUsageCounters";
import { requirePermission } from "./utils/permissions";
import { getWorkflowConfig } from "./utils/workflowConfigs";
import { getPositiveWorkflowSteps } from "./utils/workflowSteps";

type EnabledModule = ModuleId;

type OrganizationSettings = Doc<"organizations">["settings"];
type PermissionCategory = Doc<"permissions">["category"];

function shouldScheduleInvitationEmail(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

function getEffectiveRootOrganizationId(
  organization: Doc<"organizations">,
): Id<"organizations"> {
  return organization.rootOrganizationId ?? organization._id;
}

function hasHierarchyAccess(organization: Doc<"organizations">) {
  const tier = organization.subscriptionTier ?? "free";
  return tier === "pro" || tier === "enterprise";
}

async function requireHierarchyOwnerAccess(
  ctx: Parameters<typeof requirePermission>[0],
  parentOrganizationId: Id<"organizations">,
) {
  await requirePermission(
    ctx,
    parentOrganizationId,
    "organization.manage_settings",
  );

  const parentOrganization = await ctx.db.get(parentOrganizationId);
  if (!parentOrganization) {
    throw new ConvexError("Parent organization not found");
  }

  const rootOrganizationId = getEffectiveRootOrganizationId(parentOrganization);
  const rootOrganization = await ctx.db.get(rootOrganizationId);
  if (!rootOrganization) {
    throw new ConvexError("Root organization not found");
  }

  if (!hasHierarchyAccess(rootOrganization)) {
    throw new ConvexError(
      "Creating sub-organizations requires a Pro or Enterprise plan",
    );
  }

  return { parentOrganization, rootOrganizationId };
}

/**
 * Create new organization
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("museum"),
      v.literal("gallery"),
      v.literal("library"),
      v.literal("collector"),
    ),
    settings: v.optional(
      v.object({
        accessionNumberFormat: v.optional(v.string()),
        autoGenerateAccessionNumbers: v.optional(v.boolean()),
        accessionWorkflowEnabled: v.optional(v.boolean()),
        deaccessionWorkflowEnabled: v.optional(v.boolean()),
        locationTrackingEnabled: v.optional(v.boolean()),
        locationTypes: v.optional(v.array(v.string())),
        enableDetailedConditionReports: v.optional(v.boolean()),
      }),
    ),
    parentOrganizationId: v.optional(v.id("organizations")),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Organization name is required");
    }

    const normalizedSlug = (args.slug || name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!normalizedSlug) {
      throw new ConvexError("Organization slug is required");
    }

    // Check if slug is unique
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
      .first();

    if (existing) {
      throw new ConvexError({
        code: "ORGANIZATION_SLUG_TAKEN",
        message: "Organization slug already exists",
      });
    }

    const hierarchy = args.parentOrganizationId
      ? await requireHierarchyOwnerAccess(ctx, args.parentOrganizationId)
      : null;

    const orgPrefix = normalizedSlug.toUpperCase().substring(0, 3);
    const defaultAccessionFormat = `${orgPrefix}-{YYYY}-{####}`;

    const defaultSettings = {
      autoGenerateAccessionNumbers: true,
      accessionNumberFormat: defaultAccessionFormat,
      accessionWorkflowEnabled: true,
      deaccessionWorkflowEnabled: true,
      locationTrackingEnabled: true,
    };

    const mergedSettings = args.settings
      ? {
          ...defaultSettings,
          ...args.settings,
          autoGenerateAccessionNumbers:
            args.settings.autoGenerateAccessionNumbers ?? true,
          accessionNumberFormat:
            args.settings.accessionNumberFormat || defaultAccessionFormat,
          accessionWorkflowEnabled:
            args.settings.accessionWorkflowEnabled ?? true,
          deaccessionWorkflowEnabled:
            args.settings.deaccessionWorkflowEnabled ?? true,
          locationTrackingEnabled:
            args.settings.locationTrackingEnabled ?? true,
        }
      : defaultSettings;

    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug: normalizedSlug,
      type: args.type,
      settings: mergedSettings,
      subscriptionTier: "free",
      parentOrganizationId: args.parentOrganizationId,
      rootOrganizationId: hierarchy?.rootOrganizationId,
    });
    await Promise.all([
      ctx.db.insert(
        "organizationUsageCounters",
        createEmptyUsageCounter(organizationId),
      ),
      ctx.runMutation(internal.organizations.createDefaultRoles, {
        organizationId,
      }),
    ]);
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    const adminRole = roles.find((r) => r.name === "admin" && r.isSystemRole);
    const registrarRole = roles.find(
      (r) => r.name === "registrar" && r.isSystemRole,
    );
    const curatorRole = roles.find(
      (r) => r.name === "curator" && r.isSystemRole,
    );

    if (adminRole) {
      await Promise.all([
        ctx.db.insert("userOrganizations", {
          userId,
          organizationId,
          roleId: adminRole._id,
          joinedAt: Date.now(),
        }),
        ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "accession",
          steps: [
            {
              stepNumber: 1,
              roleId: registrarRole?._id ?? adminRole._id,
              name: "Registrar Review",
            },
            {
              stepNumber: 2,
              roleId: curatorRole?._id ?? adminRole._id,
              name: "Curator Approval",
            },
          ],
          canInitiateRoles: [
            adminRole._id,
            ...(registrarRole ? [registrarRole._id] : []),
          ],
        }),
        ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "deaccession",
          steps: [
            {
              stepNumber: 1,
              roleId: curatorRole?._id ?? adminRole._id,
              name: "Curator Review",
            },
            {
              stepNumber: 2,
              roleId: adminRole._id,
              name: "Director Approval",
            },
          ],
          canInitiateRoles: [
            adminRole._id,
            ...(curatorRole ? [curatorRole._id] : []),
          ],
        }),
        ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "loan",
          steps: [
            {
              stepNumber: 1,
              roleId: registrarRole?._id ?? adminRole._id,
              name: "Registrar Review",
            },
            {
              stepNumber: 2,
              roleId: curatorRole?._id ?? adminRole._id,
              name: "Curator Approval",
            },
          ],
          canInitiateRoles: [
            adminRole._id,
            ...(registrarRole ? [registrarRole._id] : []),
          ],
        }),
        ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "acquisition",
          steps: [
            {
              stepNumber: 1,
              roleId: adminRole._id,
              name: "Director Approval",
            },
          ],
          canInitiateRoles: [
            adminRole._id,
            ...(curatorRole ? [curatorRole._id] : []),
          ],
        }),
        ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "exhibition",
          steps: [
            {
              stepNumber: 1,
              roleId: adminRole._id,
              name: "Director Approval",
            },
          ],
          canInitiateRoles: [
            adminRole._id,
            ...(curatorRole ? [curatorRole._id] : []),
          ],
        }),
        ctx.db.insert("workflowConfigs", {
          organizationId,
          workflowType: "conservation",
          steps: [
            {
              stepNumber: 1,
              roleId: curatorRole?._id ?? adminRole._id,
              name: "Curator Approval",
            },
          ],
          canInitiateRoles: [
            adminRole._id,
            ...(registrarRole ? [registrarRole._id] : []),
            ...(curatorRole ? [curatorRole._id] : []),
          ],
        }),
      ] as const);
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId,
      action: "created_organization",
      entityType: "organization",
      entityId: organizationId,
      changes: {
        name,
        slug: normalizedSlug,
        type: args.type,
        parentOrganizationId: args.parentOrganizationId,
        rootOrganizationId: hierarchy?.rootOrganizationId,
      },
    });

    return organizationId;
  },
});

/**
 * Get organization by ID
 */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      settings: v.optional(
        v.object({
          accessionNumberFormat: v.optional(v.string()),
          accessionCounterScope: v.optional(
            v.union(
              v.literal("global"),
              v.literal("year"),
              v.literal("month"),
              v.literal("day"),
            ),
          ),
          autoGenerateAccessionNumbers: v.optional(v.boolean()),
          accessionWorkflowEnabled: v.optional(v.boolean()),
          deaccessionWorkflowEnabled: v.optional(v.boolean()),
          locationTrackingEnabled: v.optional(v.boolean()),
          locationTypes: v.optional(v.array(v.string())),
          enableDetailedConditionReports: v.optional(v.boolean()),
          enabledIntegrations: v.optional(v.array(v.string())),
          enabledModules: v.optional(v.array(enabledModuleValidator)),
          portalSettings: v.optional(
            v.object({
              isEnabled: v.optional(v.boolean()),
              isSearchEnabled: v.optional(v.boolean()),
              isHighResEnabled: v.optional(v.boolean()),
              isValuationVisible: v.optional(v.boolean()),
              portalSlug: v.optional(v.string()),
            }),
          ),
          watermarkSettings: v.optional(
            v.object({
              isEnabled: v.optional(v.boolean()),
              text: v.optional(v.string()),
              opacity: v.optional(v.number()),
              position: v.optional(
                v.union(
                  v.literal("center"),
                  v.literal("top-left"),
                  v.literal("top-right"),
                  v.literal("bottom-left"),
                  v.literal("bottom-right"),
                ),
              ),
            }),
          ),
        }),
      ),
      subscriptionTier: v.optional(
        v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
      ),
      parentOrganizationId: v.optional(v.id("organizations")),
      rootOrganizationId: v.optional(v.id("organizations")),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    return org;
  },
});

/**
 * Get organization by slug
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      logoUrl: v.optional(v.string()),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      settings: v.optional(
        v.object({
          accessionNumberFormat: v.optional(v.string()),
          accessionCounterScope: v.optional(
            v.union(
              v.literal("global"),
              v.literal("year"),
              v.literal("month"),
              v.literal("day"),
            ),
          ),
          autoGenerateAccessionNumbers: v.optional(v.boolean()),
          accessionWorkflowEnabled: v.optional(v.boolean()),
          deaccessionWorkflowEnabled: v.optional(v.boolean()),
          locationTrackingEnabled: v.optional(v.boolean()),
          locationTypes: v.optional(v.array(v.string())),
          enableDetailedConditionReports: v.optional(v.boolean()),
          enabledIntegrations: v.optional(v.array(v.string())),
          enabledModules: v.optional(v.array(enabledModuleValidator)),
          portalSettings: v.optional(
            v.object({
              isEnabled: v.optional(v.boolean()),
              isSearchEnabled: v.optional(v.boolean()),
              isHighResEnabled: v.optional(v.boolean()),
              isValuationVisible: v.optional(v.boolean()),
              portalSlug: v.optional(v.string()),
            }),
          ),
        }),
      ),
      subscriptionTier: v.optional(
        v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
      ),
      parentOrganizationId: v.optional(v.id("organizations")),
      rootOrganizationId: v.optional(v.id("organizations")),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!org) return null;

    let logoUrl: string | undefined;
    if (org.logoId) {
      logoUrl = (await ctx.storage.getUrl(org.logoId)) ?? undefined;
    }

    return {
      ...org,
      logoUrl,
    };
  },
});

/**
 * Update organization settings
 */
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    settings: v.optional(
      v.object({
        accessionNumberFormat: v.optional(v.string()),
        accessionCounterScope: v.optional(
          v.union(
            v.literal("global"),
            v.literal("year"),
            v.literal("month"),
            v.literal("day"),
          ),
        ),
        autoGenerateAccessionNumbers: v.optional(v.boolean()),
        accessionWorkflowEnabled: v.optional(v.boolean()),
        deaccessionWorkflowEnabled: v.optional(v.boolean()),
        locationTrackingEnabled: v.optional(v.boolean()),
        locationTypes: v.optional(v.array(v.string())),
        enableDetailedConditionReports: v.optional(v.boolean()),
        enabledIntegrations: v.optional(v.array(v.string())),
        enabledModules: v.optional(v.array(enabledModuleValidator)),
      }),
    ),
    subscriptionTier: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const updates: {
      name?: string;
      settings?: {
        accessionNumberFormat?: string;
        accessionCounterScope?: "global" | "year" | "month" | "day";
        autoGenerateAccessionNumbers?: boolean;
        accessionWorkflowEnabled?: boolean;
        deaccessionWorkflowEnabled?: boolean;
        locationTrackingEnabled?: boolean;
        locationTypes?: string[];
        enableDetailedConditionReports?: boolean;
        enabledIntegrations?: string[];
        enabledModules?: EnabledModule[];
      };
      subscriptionTier?: "free" | "pro" | "enterprise";
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.settings !== undefined) {
      const mergedSettings: OrganizationSettings = {
        ...(org.settings ?? {}),
        ...args.settings,
      };
      updates.settings = mergedSettings;
    }
    if (args.subscriptionTier !== undefined) {
      updates.subscriptionTier = args.subscriptionTier;
    }

    await Promise.all([
      ctx.db.patch(args.organizationId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "updated_organization",
        entityType: "organization",
        entityId: args.organizationId,
        changes: updates,
      }),
    ]);

    return null;
  },
});

/**
 * Get organization settings
 */
export const getSettings = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      accessionNumberFormat: v.optional(v.string()),
      accessionCounterScope: v.optional(
        v.union(
          v.literal("global"),
          v.literal("year"),
          v.literal("month"),
          v.literal("day"),
        ),
      ),
      autoGenerateAccessionNumbers: v.optional(v.boolean()),
      accessionWorkflowEnabled: v.optional(v.boolean()),
      deaccessionWorkflowEnabled: v.optional(v.boolean()),
      locationTrackingEnabled: v.optional(v.boolean()),
      locationTypes: v.optional(v.array(v.string())),
      enableDetailedConditionReports: v.optional(v.boolean()),
      enabledIntegrations: v.optional(v.array(v.string())),
      portalSettings: v.optional(
        v.object({
          isEnabled: v.optional(v.boolean()),
          isSearchEnabled: v.optional(v.boolean()),
          isHighResEnabled: v.optional(v.boolean()),
          isValuationVisible: v.optional(v.boolean()),
          portalSlug: v.optional(v.string()),
        }),
      ),
      watermarkSettings: v.optional(
        v.object({
          isEnabled: v.optional(v.boolean()),
          text: v.optional(v.string()),
          opacity: v.optional(v.number()),
          position: v.optional(
            v.union(
              v.literal("center"),
              v.literal("top-left"),
              v.literal("top-right"),
              v.literal("bottom-left"),
              v.literal("bottom-right"),
            ),
          ),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    return org?.settings ?? null;
  },
});

/**
 * Get organization usage statistics
 */
export const getUsageStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    storage: v.object({
      used: v.number(),
      limit: v.union(v.number(), v.null()),
    }),
    objects: v.object({
      used: v.number(),
      limit: v.union(v.number(), v.null()),
    }),
    exports: v.object({
      used: v.number(),
      limit: v.union(v.number(), v.null()),
    }),
  }),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const tier: SubscriptionTier = org.subscriptionTier ?? "free";
    const limits = getTierLimits(tier);
    const usageCounter =
      (await getUsageCounter(ctx, args.organizationId)) ??
      createEmptyUsageCounter(args.organizationId);

    // Get export count for current month
    function getMonthStart(timestamp: number) {
      const date = new Date(timestamp);
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    }
    const periodStart = getMonthStart(Date.now());
    const exportUsage = await ctx.db
      .query("exportUsage")
      .withIndex("by_organization_and_period", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("periodStart", periodStart),
      )
      .first();
    const exportCount = exportUsage?.count ?? 0;

    return {
      tier,
      storage: {
        used: usageCounter.storageBytes,
        limit: limits.mediaBytes,
      },
      objects: {
        used: usageCounter.objectCount,
        limit: limits.objects,
      },
      exports: {
        used: exportCount,
        limit: limits.exportsPerMonth,
      },
    };
  },
});

/**
 * Get workflow configurations for an organization
 */
export const getWorkflowConfigs = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("workflowConfigs"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      workflowType: v.union(
        v.literal("accession"),
        v.literal("deaccession"),
        v.literal("loan"),
        v.literal("acquisition"),
        v.literal("exhibition"),
        v.literal("conservation"),
      ),
      steps: v.array(
        v.object({
          stepNumber: v.number(),
          roleId: v.id("roles"),
          name: v.string(),
          requiredDocuments: v.optional(v.array(v.string())),
          approvalMode: v.optional(
            v.union(
              v.literal("single"),
              v.literal("multi"),
              v.literal("unanimous"),
            ),
          ),
          requiredApprovals: v.optional(v.number()),
          allowedNextSteps: v.optional(v.array(v.number())),
          canSkip: v.optional(v.boolean()),
        }),
      ),
      canInitiateRoles: v.array(v.id("roles")),
      requiredDocuments: v.optional(
        v.array(
          v.object({
            documentType: v.string(),
            description: v.optional(v.string()),
            requiredAtStep: v.optional(v.number()),
          }),
        ),
      ),
      requireSourceVerification: v.optional(v.boolean()),
      templateId: v.optional(v.id("workflowTemplates")),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
  },
});

/**
 * Update workflow configuration
 */
export const updateWorkflowConfig = mutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: v.union(
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("loan"),
      v.literal("acquisition"),
      v.literal("exhibition"),
      v.literal("conservation"),
    ),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        roleId: v.id("roles"),
        name: v.string(),
      }),
    ),
    canInitiateRoles: v.array(v.id("roles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (getPositiveWorkflowSteps(args.steps).length === 0) {
      throw new Error(
        "Workflow must include at least one approval step with stepNumber greater than 0",
      );
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const existing = await getWorkflowConfig(
      ctx,
      args.organizationId,
      args.workflowType,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: args.steps,
        canInitiateRoles: args.canInitiateRoles,
      });
    } else {
      await ctx.db.insert("workflowConfigs", {
        organizationId: args.organizationId,
        workflowType: args.workflowType,
        steps: args.steps,
        canInitiateRoles: args.canInitiateRoles,
      });
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "updated_workflow_config",
      entityType: "workflowConfig",
      entityId: existing?._id ?? args.organizationId,
      changes: {
        workflowType: args.workflowType,
        stepsCount: args.steps.length,
      },
    });

    return null;
  },
});

/**
 * Update accession number format
 */
export const updateAccessionNumberFormat = mutation({
  args: {
    organizationId: v.id("organizations"),
    format: v.string(),
    autoGenerate: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    await Promise.all([
      ctx.db.patch(args.organizationId, {
        settings: {
          ...org.settings,
          accessionNumberFormat: args.format,
          autoGenerateAccessionNumbers: args.autoGenerate,
        },
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "updated_accession_format",
        entityType: "organization",
        entityId: args.organizationId,
        changes: {
          format: args.format,
          autoGenerate: args.autoGenerate,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Update portal settings
 */
export const updatePortalSettings = mutation({
  args: {
    organizationId: v.id("organizations"),
    portalSettings: v.object({
      isEnabled: v.optional(v.boolean()),
      isSearchEnabled: v.optional(v.boolean()),
      isHighResEnabled: v.optional(v.boolean()),
      isValuationVisible: v.optional(v.boolean()),
      portalSlug: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(
        ctx,
        args.organizationId,
        "organization.manage_settings",
      ),
      requireFeatureAccess(ctx, args.organizationId, "public_portal"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Merge settings
    await ctx.db.patch(args.organizationId, {
      settings: {
        ...org.settings,
        portalSettings: {
          ...org.settings?.portalSettings,
          ...args.portalSettings,
        },
      },
    });

    // Audit log
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "updated_portal_settings",
      entityType: "organization",
      entityId: args.organizationId,
      changes: args.portalSettings,
    });

    return null;
  },
});

/**
 * Update watermark settings
 */
export const updateWatermarkSettings = mutation({
  args: {
    organizationId: v.id("organizations"),
    watermarkSettings: v.object({
      isEnabled: v.optional(v.boolean()),
      text: v.optional(v.string()),
      opacity: v.optional(v.number()),
      position: v.optional(
        v.union(
          v.literal("center"),
          v.literal("top-left"),
          v.literal("top-right"),
          v.literal("bottom-left"),
          v.literal("bottom-right"),
        ),
      ),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Permission check
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Merge settings
    await ctx.db.patch(args.organizationId, {
      settings: {
        ...org.settings,
        watermarkSettings: {
          ...org.settings?.watermarkSettings,
          ...args.watermarkSettings,
        },
      },
    });

    // Audit log
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "updated_watermark_settings",
      entityType: "organization",
      entityId: args.organizationId,
      changes: args.watermarkSettings,
    });

    return null;
  },
});

/**
 * Get portal settings for an organization
 */
export const getPortalSettings = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    isEnabled: v.boolean(),
    isSearchEnabled: v.boolean(),
    isHighResEnabled: v.boolean(),
    isValuationVisible: v.boolean(),
    portalSlug: v.string(),
    orgSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const portalSettings = org.settings?.portalSettings;

    return {
      isEnabled: portalSettings?.isEnabled ?? false,
      isSearchEnabled: portalSettings?.isSearchEnabled ?? false,
      isHighResEnabled: portalSettings?.isHighResEnabled ?? false,
      isValuationVisible: portalSettings?.isValuationVisible ?? false,
      portalSlug: portalSettings?.portalSlug ?? "gallery",
      orgSlug: org.slug,
    };
  },
});

/**
 * List user's organizations
 */
export const listUserOrganizations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      role: v.object({
        _id: v.id("roles"),
        name: v.string(),
        description: v.optional(v.string()),
        isSystemRole: v.boolean(),
      }),
      settings: v.optional(
        v.object({
          locationTrackingEnabled: v.optional(v.boolean()),
          enabledIntegrations: v.optional(v.array(v.string())),
          enabledModules: v.optional(v.array(enabledModuleValidator)),
        }),
      ),
      subscriptionTier: v.optional(
        v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
      ),
      parentOrganizationId: v.optional(v.id("organizations")),
      rootOrganizationId: v.optional(v.id("organizations")),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const userOrganizations = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const organizations = await Promise.all(
      userOrganizations.map(async (uo) => {
        const [org, role] = await Promise.all([
          ctx.db.get(uo.organizationId),
          ctx.db.get(uo.roleId),
        ] as const);
        if (!org || !role) {
          return null;
        }
        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          role: {
            _id: role._id,
            name: role.name,
            description: role.description,
            isSystemRole: role.isSystemRole,
          },
          settings: org.settings
            ? {
                locationTrackingEnabled: org.settings.locationTrackingEnabled,
                enabledIntegrations: org.settings.enabledIntegrations,
                enabledModules: org.settings.enabledModules,
              }
            : undefined,
          subscriptionTier: org.subscriptionTier,
          parentOrganizationId: org.parentOrganizationId,
          rootOrganizationId: org.rootOrganizationId,
          _creationTime: org._creationTime,
        };
      }),
    );

    return organizations.filter(
      (org): org is NonNullable<typeof org> => org !== null,
    );
  },
});

export const listChildOrganizations = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      parentOrganizationId: v.optional(v.id("organizations")),
      rootOrganizationId: v.optional(v.id("organizations")),
      subscriptionTier: v.optional(
        v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
      ),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const rootOrganizationId = getEffectiveRootOrganizationId(organization);
    const children = await ctx.db
      .query("organizations")
      .withIndex("by_root_organization", (q) =>
        q.eq("rootOrganizationId", rootOrganizationId),
      )
      .collect();

    return children
      .filter((child) => child._id !== args.organizationId)
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

/**
 * Invite user to organization
 */
export const inviteUser = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "users.invite");

    const normalizedEmail = args.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new ConvexError("Email is required");
    }

    const role = await ctx.db.get(args.roleId);
    if (!role || role.organizationId !== args.organizationId) {
      throw new ConvexError("Invalid role for organization");
    }

    // If the user already exists, ensure they are not already in the organization.
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (existingUser) {
      const existingMembership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q
            .eq("userId", existingUser._id)
            .eq("organizationId", args.organizationId),
        )
        .first();

      if (existingMembership) {
        throw new ConvexError("User is already in this organization");
      }
    }

    try {
      await enforceUserQuota(ctx, args.organizationId);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "User limit reached for current tier"
      ) {
        throw new ConvexError(error.message);
      }
      throw error;
    }

    const [invitation, organization] = await Promise.all([
      ctx.runMutation(internal.invitations.createInvitationInternal, {
        organizationId: args.organizationId,
        roleId: args.roleId,
        email: normalizedEmail,
        invitedBy: userId,
      }),
      ctx.db.get(args.organizationId),
    ] as const);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }
    const inviter = await ctx.db.get(userId);
    const inviterName = inviter?.name ?? inviter?.email ?? "A team member";

    if (shouldScheduleInvitationEmail()) {
      await ctx.scheduler.runAfter(
        0,
        internal.email.actions.sendInvitationEmailAction,
        {
          email: normalizedEmail,
          organizationName: organization.name,
          inviterName,
          role: role.name,
          token: invitation.token,
        },
      );
    }

    return null;
  },
});

/**
 * Remove user from organization
 */
export const removeUser = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const [, userOrganization] = await Promise.all([
      requirePermission(ctx, args.organizationId, "users.remove"),
      ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", args.userId).eq("organizationId", args.organizationId),
        )
        .first(),
    ] as const);

    if (!userOrganization) {
      throw new Error("User is not in this organization");
    }

    await Promise.all([
      ctx.db.delete(userOrganization._id),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId: currentUserId,
        action: "removed_user",
        entityType: "user",
        entityId: args.userId,
        changes: {
          removedUserId: args.userId,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Update user's role in organization
 */
export const updateUserRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    const [, userOrganization] = await Promise.all([
      requirePermission(ctx, args.organizationId, "users.manage_roles"),
      ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", args.userId).eq("organizationId", args.organizationId),
        )
        .first(),
    ] as const);

    if (!userOrganization) {
      throw new Error("User is not in this organization");
    }

    await Promise.all([
      ctx.db.patch(userOrganization._id, {
        roleId: args.roleId,
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId: currentUserId,
        action: "updated_user_role",
        entityType: "user",
        entityId: args.userId,
        changes: {
          previousRoleId: userOrganization.roleId,
          newRoleId: args.roleId,
        },
      }),
    ]);

    return null;
  },
});

/**
 * List users in an organization
 */
export const listOrganizationUsers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      userOrganizationId: v.id("userOrganizations"),
      role: v.object({
        _id: v.id("roles"),
        name: v.string(),
        description: v.optional(v.string()),
        isSystemRole: v.boolean(),
      }),
      joinedAt: v.number(),
      invitedBy: v.optional(v.id("users")),
    }),
  ),
  handler: async (ctx, args) => {
    const userOrganizations = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const usersWithRoles = await Promise.all(
      userOrganizations.map(async (uo) => {
        const [user, role] = await Promise.all([
          ctx.db.get(uo.userId),
          ctx.db.get(uo.roleId),
        ] as const);
        if (!user || !role) {
          return null;
        }
        const avatarUrl = user.imageId
          ? await ctx.storage.getUrl(user.imageId)
          : null;
        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
          avatarUrl: avatarUrl ?? undefined,
          userOrganizationId: uo._id,
          role: {
            _id: role._id,
            name: role.name,
            description: role.description,
            isSystemRole: role.isSystemRole,
          },
          joinedAt: uo.joinedAt,
          invitedBy: uo.invitedBy,
        };
      }),
    );

    return usersWithRoles.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const listOrganizationsForBackfill = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      enabledIntegrations: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    return organizations.map((org) => ({
      _id: org._id,
      enabledIntegrations: org.settings?.enabledIntegrations ?? [],
    }));
  },
});

export const listOrganizationUserIds = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.id("users")),
  handler: async (ctx, args) => {
    const userOrganizations = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    return userOrganizations.map((uo) => uo.userId);
  },
});

/**
 * Internal: Create default roles for a new organization
 */
export const createDefaultRoles = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create system roles
    const [adminRole, curatorRole, registrarRole, catalogerRole, viewerRole] =
      await Promise.all([
        ctx.db.insert("roles", {
          organizationId: args.organizationId,
          name: "admin",
          description: "Full organization access",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId: args.organizationId,
          name: "curator",
          description:
            "Collection management and accession/deaccession approval",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId: args.organizationId,
          name: "registrar",
          description:
            "Accession/deaccession workflows, location management, loans",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId: args.organizationId,
          name: "cataloger",
          description: "Object cataloging and media management",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId: args.organizationId,
          name: "viewer",
          description: "Read-only access",
          isSystemRole: true,
        }),
      ] as const);
    // Create default permissions (if they don't exist)
    const permissionNames = [
      // Collections
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.delete",
      "collections.approve_accession",
      "collections.approve_deaccession",
      "collections.approve_acquisition",
      "collections.approve_exhibition",
      "collections.approve_conservation",
      // Loans
      "loans.create",
      "loans.read",
      "loans.update",
      "loans.delete",
      "loans.approve",
      "loans.view_admin_overview",
      "loans.view_transport",
      // Locations
      "locations.create",
      "locations.read",
      "locations.update",
      "locations.delete",
      // Sites
      "sites.create",
      "sites.read",
      "sites.update",
      "sites.delete",
      // Media
      "media.upload",
      "media.read",
      "media.delete",
      // Users
      "users.invite",
      "users.manage_roles",
      "users.remove",
      // Organization
      "organization.manage_settings",
      "organization.view_analytics",
      // Accounts
      "accounts.read",
      "accounts.write",
      "accounts.manage",
      "accounts.delete",
    ];

    const permissionMap = new Map<string, Id<"permissions">>();

    await Promise.all(
      Array.from(permissionNames).map(async (permName) => {
        const [category, _name] = permName.split(".");
        const permissionCategory = category as PermissionCategory;
        const existing = await ctx.db
          .query("permissions")
          .withIndex("by_category", (q) => q.eq("category", permissionCategory))
          .filter((q) => q.eq(q.field("name"), permName))
          .first();

        let permId: Id<"permissions">;
        if (existing) {
          permId = existing._id;
        } else {
          permId = await ctx.db.insert("permissions", {
            name: permName,
            description: `Permission: ${permName}`,
            category: permissionCategory,
          });
        }
        permissionMap.set(permName, permId);
      }),
    );

    // Assign permissions to roles
    // Admin: all permissions
    await Promise.all(
      Array.from(permissionMap.values()).map(async (permId) => {
        await ctx.db.insert("rolePermissions", {
          roleId: adminRole,
          permissionId: permId,
        });
      }),
    );

    // Curator: collections + media + locations + sites
    const curatorPerms = [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
      "collections.approve_deaccession",
      "collections.approve_conservation",
      "media.upload",
      "media.read",
      "media.delete",
      "locations.create",
      "locations.read",
      "locations.update",
      "locations.delete",
      "sites.read",
      "accounts.read",
    ];
    await Promise.all(
      Array.from(curatorPerms).map(async (permName) => {
        const permId = permissionMap.get(permName);
        if (permId) {
          await ctx.db.insert("rolePermissions", {
            roleId: curatorRole,
            permissionId: permId,
          });
        }
      }),
    );

    // Registrar: workflows + locations + loans + sites
    const registrarPerms = [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
      "collections.approve_deaccession",
      "loans.create",
      "loans.read",
      "loans.update",
      "loans.delete",
      "loans.approve",
      "loans.view_admin_overview",
      "loans.view_transport",
      "locations.create",
      "locations.read",
      "locations.update",
      "locations.delete",
      "sites.read",
      "media.read",
      "accounts.read",
      "accounts.write",
      "organization.view_analytics",
    ];
    await Promise.all(
      Array.from(registrarPerms).map(async (permName) => {
        const permId = permissionMap.get(permName);
        if (permId) {
          await ctx.db.insert("rolePermissions", {
            roleId: registrarRole,
            permissionId: permId,
          });
        }
      }),
    );

    // Cataloger: collections + media + sites
    const catalogerPerms = [
      "collections.create",
      "collections.read",
      "collections.update",
      "media.upload",
      "media.read",
      "media.delete",
      "locations.read",
      "sites.read",
      "accounts.read",
    ];
    await Promise.all(
      Array.from(catalogerPerms).map(async (permName) => {
        const permId = permissionMap.get(permName);
        if (permId) {
          await ctx.db.insert("rolePermissions", {
            roleId: catalogerRole,
            permissionId: permId,
          });
        }
      }),
    );

    // Viewer: read-only
    const viewerPerms = [
      "collections.read",
      "loans.read",
      "locations.read",
      "sites.read",
      "media.read",
      "accounts.read",
    ];
    await Promise.all(
      Array.from(viewerPerms).map(async (permName) => {
        const permId = permissionMap.get(permName);
        if (permId) {
          await ctx.db.insert("rolePermissions", {
            roleId: viewerRole,
            permissionId: permId,
          });
        }
      }),
    );

    return null;
  },
});

/**
 * Validate accession number format template
 */
export const validateAccessionFormat = query({
  args: {
    template: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.object({
    isValid: v.boolean(),
    error: v.optional(v.string()),
    preview: v.string(),
    examples: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    return accessionParser.validate(args.template, args.organizationSlug);
  },
});

/**
 * Get preview of next accession number
 */
export const getAccessionNumberPreview = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      preview: v.string(),
      nextNumber: v.string(),
      template: v.string(),
      scope: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      return null;
    }

    const template = org.settings?.accessionNumberFormat;
    if (!template) {
      return null;
    }

    const now = new Date();
    const counterScope =
      org.settings?.accessionCounterScope ||
      accessionParser.getCounterScopeFromTemplate(template);
    const scopeKey = accessionParser.getScopeKey(counterScope, now);

    // Get next counter value for preview
    const nextCounter = await getNextCounterPreview(
      ctx,
      args.organizationId,
      counterScope,
      scopeKey,
    );

    const preview = accessionParser.parse(template, {
      organizationSlug: org.slug,
      currentDate: now,
      counterValue: nextCounter,
      counterScope,
    });

    return {
      preview,
      nextNumber: preview,
      template,
      scope: counterScope,
    };
  },
});

/**
 * Get template presets
 */
export const getAccessionTemplatePresets = query({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      template: v.string(),
      description: v.string(),
    }),
  ),
  handler: async () => {
    return AccessionNumberParser.getPresets();
  },
});
