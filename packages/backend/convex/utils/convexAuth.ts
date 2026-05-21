import { v } from "convex/values";
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireAuthenticatedOrganization } from "./authorizationContext";
import { enabledModuleValidator } from "./moduleValidators";

/**
 * Custom query builder that authenticates the caller and checks org permission
 * before running the handler. Handlers receive `ctx.userId` and `ctx.organizationId`.
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
 * Custom mutation builder with the same org auth gate as `organizationQuery`.
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

export type OrganizationAuthCtx = {
  userId: Id<"users">;
  organizationId: Id<"organizations">;
};
