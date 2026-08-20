import { v, type Infer } from "convex/values";
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
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
