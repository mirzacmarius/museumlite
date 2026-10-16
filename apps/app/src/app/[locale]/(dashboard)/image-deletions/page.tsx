"use client";

import { useOrganization } from "@/components/organization-provider";
import { useI18n, useScopedI18n } from "@/locales/client";
import { MyWorkBoardSkeleton } from "../dashboard-page-skeleton";
import { ImageDeletionRequests } from "./_components/image-deletion-requests";

export default function ImageDeletionsPage() {
  const { currentOrganizationId, isLoading } = useOrganization();
  const t = useScopedI18n("imageDeletion.approvals");
  const tRoot = useI18n();

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5">
        <header className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </header>
        {isLoading ? (
          <MyWorkBoardSkeleton />
        ) : currentOrganizationId ? (
          <ImageDeletionRequests organizationId={currentOrganizationId} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <h2 className="text-sm font-semibold text-foreground">
              {tRoot("assignmentsPage.selectOrg.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tRoot("assignmentsPage.selectOrg.description")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
