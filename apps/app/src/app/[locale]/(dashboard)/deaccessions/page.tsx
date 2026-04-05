import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { getScopedI18n } from "@/locales/server";
import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { Archive, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";
import { DeaccessionsPageClient } from "./deaccessions-page-client";

export const dynamic = "force-dynamic";

export default async function DeaccessionsPage() {
  const token = await convexAuthNextjsToken();

  const [user, organizations, preferredOrgId] = await Promise.all([
    fetchQuery(api.users.getUser, {}, { token }),
    fetchQuery(api.organizations.listUserOrganizations, {}, { token }),
    fetchQuery(api.userPreferences.get, { key: "organization.activeOrgId" }, { token }),
  ]);

  if (!user?.username) {
    redirect("/onboarding");
  }

  if (!organizations || organizations.length === 0) {
    return <NoOrganizationState />;
  }

  const selectedOrg =
    (preferredOrgId
      ? organizations.find((organization) => organization._id === preferredOrgId)
      : null) ?? organizations[0];

  if (!selectedOrg) {
    return <NoOrganizationState />;
  }

  const preloadedDeaccessions = await preloadQuery(
    api.deaccessions.list,
    {
      organizationId: selectedOrg._id,
      paginationOpts: { numItems: 100, cursor: null },
    },
    { token },
  );

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <Suspense fallback={<AccessionsPageSkeleton />}>
        <DeaccessionsPageClient
          organizationId={selectedOrg._id}
          preloadedDeaccessions={preloadedDeaccessions}
        />
      </Suspense>
    </div>
  );
}

async function NoOrganizationState() {
  const t = await getScopedI18n("deaccessions");

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Archive className="h-6 w-6" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            {t("noOrg.title")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noOrg.description")}
          </p>
        </div>
        <Link
          href="/organizations/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
        >
          <Plus className="h-4 w-4" />
          {t("noOrg.createButton")}
        </Link>
      </div>
    </div>
  );
}
