"use client";

import { useOrganization } from "@/components/organization-provider";
import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AssignmentsPageClient } from "./_components/assignments-page-client";
import { AssignmentsPageSkeleton } from "./assignments-page-skeleton";

export default function AssignmentsPage() {
  const t = useI18n();
  const { currentOrganizationId, isLoading: orgLoading } = useOrganization();

  const assignments = useQuery(
    api.assignments.listMyAssignments,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          limit: 50,
        }
      : "skip",
  );

  if (orgLoading) {
    return <AssignmentsPageSkeleton />;
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-black px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-white/10 bg-black p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">
              {t("assignmentsPage.selectOrg.title")}
            </h3>
            <p className="mt-2 text-sm text-white/60">
              {t("assignmentsPage.selectOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (assignments === undefined) {
    return <AssignmentsPageSkeleton />;
  }

  return (
    <AssignmentsPageClient
      assignments={assignments}
      organizationId={currentOrganizationId}
    />
  );
}
