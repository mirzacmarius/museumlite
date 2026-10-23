import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { hasPermission } from "./utils/permissions";
import { metric, openProjection } from "./utils/projectionReads";
import { getRolePresentation } from "./utils/systemRoles";

const organizationSummaryValidator = v.object({
  _id: v.id("organizations"),
  name: v.string(),
  type: v.union(
    v.literal("museum"),
    v.literal("gallery"),
    v.literal("library"),
    v.literal("collector"),
  ),
  subscriptionTier: v.union(
    v.literal("free"),
    v.literal("pro"),
    v.literal("enterprise"),
  ),
  roleName: v.string(),
  joinedAt: v.number(),
  parentOrganizationName: v.optional(v.string()),
  /**
   * Headline counts from the Organization's projection, for members who may
   * view its analytics; null without that permission.
   */
  metrics: v.union(
    v.null(),
    v.object({ availability: v.literal("unavailable") }),
    v.object({
      availability: v.literal("ready"),
      objects: v.number(),
      activeLoans: v.number(),
      locations: v.number(),
    }),
  ),
});

/**
 * Every Organization the signed-in user belongs to, with their role and the
 * headline counts the Dashboard shows, for the All my organizations page.
 */
export const listMine = query({
  args: {},
  returns: v.array(organizationSummaryValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const summaries = await Promise.all(
      memberships.map(async (membership) => {
        const [organization, role] = await Promise.all([
          ctx.db.get(membership.organizationId),
          ctx.db.get(membership.roleId),
        ] as const);
        if (!organization || !role) return null;
        const [parent, canViewAnalytics] = await Promise.all([
          organization.parentOrganizationId
            ? ctx.db.get(organization.parentOrganizationId)
            : null,
          hasPermission(ctx, organization._id, "organization.view_analytics"),
        ] as const);
        return {
          _id: organization._id,
          name: organization.name,
          type: organization.type,
          subscriptionTier: organization.subscriptionTier ?? "free",
          roleName: getRolePresentation(role).name,
          joinedAt: membership.joinedAt,
          ...(parent ? { parentOrganizationName: parent.name } : {}),
          metrics: canViewAnalytics
            ? await headlineMetrics(ctx, organization._id)
            : null,
        };
      }),
    );
    return summaries
      .filter((summary) => summary !== null)
      .sort(
        (a, b) => a.name.localeCompare(b.name) || a._id.localeCompare(b._id),
      );
  },
});

async function headlineMetrics(
  ctx: Parameters<typeof openProjection>[0],
  organizationId: Parameters<typeof openProjection>[1],
) {
  const projection = await openProjection(ctx, organizationId);
  if (!projection.ok) return { availability: "unavailable" as const };
  const totals = await projection.reader.totals();
  return {
    availability: "ready" as const,
    objects: metric(totals, "inventory.owned"),
    activeLoans: metric(totals, "loans.active"),
    locations: metric(totals, "locations.total"),
  };
}
