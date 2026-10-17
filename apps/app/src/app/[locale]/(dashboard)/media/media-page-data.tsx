import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { getConvexServerToken } from "@/lib/convex-server-token";
import { requireCurrentOrganizationPermission } from "@/lib/organization-permissions";
import { MediaPageClient } from "./media-page-client";

type MediaFileTypeParam = "all" | "image" | "document" | "3d";

function parseFileTypeParam(
  value: string | Array<string> | undefined,
): MediaFileTypeParam {
  if (typeof value !== "string") return "all";
  if (
    value === "all" ||
    value === "image" ||
    value === "document" ||
    value === "3d"
  ) {
    return value;
  }
  return "all";
}

function parseSearchParam(value: string | Array<string> | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function MediaPageData({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | Array<string> | undefined>>;
}) {
  // The layout's permission check streams beside this page, so check here too
  // before any media is fetched.
  const [token, searchParams] = await Promise.all([
    getConvexServerToken(),
    searchParamsPromise,
    requireCurrentOrganizationPermission("organization.manage_settings"),
  ]);

  const [organizations, preferredOrgId] = await Promise.all([
    fetchQuery(api.organizations.listUserOrganizations, {}, { token }),
    fetchQuery(
      api.userPreferences.get,
      { key: "organization.activeOrgId" },
      { token },
    ),
  ]);

  if (!organizations || organizations.length === 0) {
    redirect("/onboarding");
  }

  const selectedOrg =
    (preferredOrgId
      ? organizations.find((org) => org._id === preferredOrgId)
      : null) ?? organizations[0];
  if (!selectedOrg) {
    redirect("/onboarding");
  }

  const fileType = parseFileTypeParam(searchParams.fileType);
  const search = parseSearchParam(searchParams.search);

  const [preloadedStats, preloadedUsage, preloadedMedia] = await Promise.all([
    preloadQuery(
      api.media.getStorageStats,
      { organizationId: selectedOrg._id },
      { token },
    ),
    preloadQuery(
      api.organizations.getUsageStats,
      { organizationId: selectedOrg._id },
      { token },
    ),
    preloadQuery(
      api.media.listByOrganization,
      {
        organizationId: selectedOrg._id,
        fileType: fileType !== "all" ? fileType : undefined,
        search: search !== "" ? search : undefined,
        paginationOpts: { numItems: 20, cursor: null },
      },
      { token },
    ),
  ]);

  return (
    <MediaPageClient
      organizationId={selectedOrg._id}
      initialFilters={{ fileType, search }}
      preloadedStats={preloadedStats}
      preloadedUsage={preloadedUsage}
      preloadedMedia={preloadedMedia}
    />
  );
}
