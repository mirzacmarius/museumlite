import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireAuthenticatedOrganization } from "./authorizationContext";
import { enabledModuleValidator } from "./moduleValidators";

export type OrganizationAuthCtx = {
  userId: Id<"users">;
  organizationId: Id<"organizations">;
};

type AuthFactoryConfig = {
  permission: string;
  moduleId?: Infer<typeof enabledModuleValidator>;
};

function buildOrganizationAuthInput(config: AuthFactoryConfig) {
  return async (
    ctx: Parameters<typeof requireAuthenticatedOrganization>[0],
    args: { organizationId: Id<"organizations"> },
  ) => {
    const auth = await requireAuthenticatedOrganization(ctx, {
      organizationId: args.organizationId,
      permission: config.permission,
      moduleId: config.moduleId,
    });
    return {
      ctx: {
        userId: auth.userId,
        organizationId: auth.organizationId,
      },
      args: {},
    };
  };
}

/**
 * Factory for org-scoped queries with a fixed permission (convex-helpers third `input` arg).
 *
 * @example
 * const loansReadQuery = createOrganizationQuery("loans.read");
 * export const getStats = loansReadQuery({
 *   args: { organizationId: v.id("organizations") },
 *   returns: v.null(),
 *   handler: async (ctx) => { ... ctx.organizationId ... },
 * });
 */
export function createOrganizationQuery(
  permission: string,
  moduleId?: Infer<typeof enabledModuleValidator>,
) {
  return customQuery(query, {
    args: {
      organizationId: v.id("organizations"),
    },
    input: buildOrganizationAuthInput({ permission, moduleId }),
  });
}

/**
 * Factory for org-scoped mutations with a fixed permission.
 */
export function createOrganizationMutation(
  permission: string,
  moduleId?: Infer<typeof enabledModuleValidator>,
) {
  return customMutation(mutation, {
    args: {
      organizationId: v.id("organizations"),
    },
    input: buildOrganizationAuthInput({ permission, moduleId }),
  });
}

/**
 * @deprecated Prefer `createOrganizationQuery(permission)` for per-permission builders.
 * Generic builder that requires `permission` on every call (not ergonomic for static permissions).
 */
export const organizationQuery = customQuery(query, {
  args: {
    organizationId: v.id("organizations"),
    permission: v.string(),
    moduleId: v.optional(enabledModuleValidator),
  },
  input: async (ctx, args) => {
    const auth = await requireAuthenticatedOrganization(ctx, {
      organizationId: args.organizationId,
      permission: args.permission,
      moduleId: args.moduleId,
    });
    return {
      ctx: {
        userId: auth.userId,
        organizationId: auth.organizationId,
      },
      args: {},
    };
  },
});

/**
 * @deprecated Prefer `createOrganizationMutation(permission)` for per-permission builders.
 */
export const organizationMutation = customMutation(mutation, {
  args: {
    organizationId: v.id("organizations"),
    permission: v.string(),
    moduleId: v.optional(enabledModuleValidator),
  },
  input: async (ctx, args) => {
    const auth = await requireAuthenticatedOrganization(ctx, {
      organizationId: args.organizationId,
      permission: args.permission,
      moduleId: args.moduleId,
    });
    return {
      ctx: {
        userId: auth.userId,
        organizationId: auth.organizationId,
      },
      args: {},
    };
  },
});
