import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function findPublicPortalOrganization(
  ctx: QueryCtx,
  organizationSlug: string,
  portalSlug?: string,
) {
  const organizations = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
    .collect();

  const isEnabled = (organization: Doc<"organizations">) =>
    organization.settings?.portalSettings?.isEnabled === true;

  // Only an enabled portal answers, so a slug alone never confirms that an
  // organization exists or reveals its settings.
  const organization = portalSlug
    ? organizations.find(
        (candidate) =>
          isEnabled(candidate) &&
          (candidate.settings?.portalSettings?.portalSlug ?? "gallery") ===
            portalSlug,
      )
    : organizations.find(isEnabled);

  return {
    organization: organization ?? null,
    hasOrganization: organizations.length > 0,
    hasEnabledPortal: organizations.some(isEnabled),
  };
}
