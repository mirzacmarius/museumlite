"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { ArrowLeft, Box, Clock } from "lucide-react";
import Link from "next/link";
import { ClientDate } from "@/components/client-date";
import { useScopedI18n } from "@/locales/client";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailSidebar({
  exhibition,
  locale,
  workflowHistory,
}: Pick<
  ExhibitionDetailViewProps,
  "exhibition" | "locale" | "workflowHistory"
>) {
  const t = useScopedI18n("exhibitions");
  const members = useQuery(api.exhibitions.listExhibitionObjects, { exhibitionId: exhibition._id });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <Box className="size-4" />
          {t("form.participantsLabel")} ({exhibition.participantCount})
        </h2>

        <div className="space-y-2">
          {members?.map((member) => (
            <Link key={member._id} href={`/collections/${member.collectionId}`} className="block rounded-lg border border-white/10 bg-background/50 p-3 hover:bg-muted/50">
              <span className="font-medium text-foreground">{member.collectionTitle || t("detail.unknownObject")}</span>
              <span className="ml-2 text-xs text-white/60">{member.collectionAccessionNumber} · {member.role === "featured" ? t("form.featuredRole") : t("form.participantRole")}</span>
            </Link>
          ))}
          {exhibition.legacyParticipationReview && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <p>{t("form.legacyReviewDescription")}</p>
              <Link href={`/collections/${exhibition.legacyParticipationReview.anchorCollectionId}`} className="mt-2 inline-flex items-center gap-1 underline">{t("form.includeHistoricalAnchor")} <ArrowLeft className="size-3 rotate-180" /></Link>
            </div>
          )}
        </div>
      </div>

      {workflowHistory && workflowHistory.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-6">
          <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            <Clock className="size-4" />
            {t("detail.approvalHistory")}
          </h2>

          <div className="space-y-4">
            {workflowHistory.map((item) => (
              <div
                key={`${item.step}-${item.approvedAt}`}
                className="relative border-l-2 border-border pl-4"
              >
                <div className="absolute -left-1.5 top-0.5 size-2.5 rounded-full bg-primary" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {item.step === 0
                      ? t("detail.created")
                      : item.comment?.startsWith("Rejected")
                        ? t("status.rejected")
                        : t("detail.stepApproved", {
                            step: item.step.toString(),
                          })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.approverName ?? t("detail.unknownUser")} •{" "}
                    <ClientDate timestamp={item.approvedAt} locale={locale} />
                  </p>
                  {item.comment && !item.comment.startsWith("Rejected") ? (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      "{item.comment}"
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
