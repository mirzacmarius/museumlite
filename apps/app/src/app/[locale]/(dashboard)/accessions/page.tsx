import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessionsError } from "./accessions-error";
import { AccessionsPageClient } from "./accessions-page-client";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";

export const dynamic = "force-dynamic";

export default async function AccessionsPage() {
  const token = await convexAuthNextjsToken();

  // Parallel data fetching pattern - fetch all data concurrently
  const [user, organizations] = await Promise.all([
    fetchQuery(api.users.getUser, {}, { token }),
    fetchQuery(api.organizations.listUserOrganizations, {}, { token }),
  ]);

  // Early return for auth/organization checks
  if (!user?.username) {
    redirect("/onboarding");
  }

  if (!organizations || organizations.length === 0) {
    return <NoOrganizationState />;
  }

  const firstOrg = organizations[0];
  if (!firstOrg) {
    return <NoOrganizationState />;
  }

  // Preload accessions data for client component
  const preloadedAccessions = await preloadQuery(
    api.accessions.list,
    {
      organizationId: firstOrg._id,
      paginationOpts: { numItems: 100, cursor: null },
    },
    { token },
  );

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <Suspense fallback={<AccessionsPageSkeleton />}>
        <AccessionsPageClient
          organizations={organizations}
          preloadedAccessions={preloadedAccessions}
        />
      </Suspense>
    </div>
  );
}

function NoOrganizationState() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M10 12h4" />
            <path d="M10 8h4" />
            <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
            <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
            <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            No Organization Found
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You need to create an organization to start managing accessions.
          </p>
        </div>
        <a
          href="/organizations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Create Organization
        </a>
      </div>
    </div>
  );
}
