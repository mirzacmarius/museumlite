"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Presentation } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { useScopedI18n } from "@/locales/client";
import { DetailSection } from "./detail-section";

interface ExhibitionsTabProps {
  collectionId: string;
  locale: string;
  hasAccess: boolean;
}

export function ExhibitionsTab({
  collectionId,
  locale,
  hasAccess,
}: ExhibitionsTabProps) {
  const t = useScopedI18n("exhibitions");
  const tObjects = useScopedI18n("objects");
  const exhibitions = useQuery(
    api.exhibitions?.list,
    hasAccess && collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  const collection = useQuery(
    api.collections.get,
    hasAccess && collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasAccess) {
    return (
      <FeatureGuard
        featureName={tObjects("tabs.exhibitions")}
        reason={{ kind: "tier_required", tier: "pro" }}
        showAction={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  return (
    <DetailSection
      title={tObjects("tabs.exhibitions")}
      icon={Presentation}
      bodyClassName="border-0 bg-transparent p-0 sm:p-0"
    >
      <div className="grid grid-cols-1 gap-4">
        {exhibitions === undefined ? (
          <p className="text-muted-foreground">{t("loadingExhibitions")}</p>
        ) : exhibitions && exhibitions.length > 0 ? (
          exhibitions.map((exhibition) => (
            <div
              key={exhibition._id}
              className={cn(
                "flex gap-4 rounded-xl border p-4",
                exhibition.isCurrent
                  ? "border-accent/30 bg-accent/5"
                  : "border-border/60 bg-secondary/20 opacity-75 hover:opacity-100",
              )}
            >
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary text-center">
                <span className="text-xs font-bold uppercase text-muted-foreground">
                  {exhibition.isCurrent ? (
                    t("status.now")
                  ) : (
                    <ClientDate
                      timestamp={exhibition.startDate}
                      locale={locale}
                      options={{ year: "numeric" }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-bold",
                    exhibition.isCurrent
                      ? "text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {exhibition.isCurrent ? t("status.open") : t("status.past")}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">
                  {exhibition.title}
                </h4>
                {exhibition.location && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {exhibition.location}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                    <ClientDate
                      timestamp={exhibition.startDate}
                      locale={locale}
                    />
                    {exhibition.endDate && (
                      <>
                        {" - "}
                        <ClientDate
                          timestamp={exhibition.endDate}
                          locale={locale}
                        />
                      </>
                    )}
                  </span>
                  {exhibition.isLoan && exhibition.loanVenue && (
                    <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t("status.loan")}: {exhibition.loanVenue}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : collection?.exhibitionHistory ? (
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {collection.exhibitionHistory}
            </p>
          </div>
        ) : (
          <EmptyState
            variant="card"
            size="sm"
            title={t("emptyState.noExhibitions")}
          />
        )}
      </div>
    </DetailSection>
  );
}
