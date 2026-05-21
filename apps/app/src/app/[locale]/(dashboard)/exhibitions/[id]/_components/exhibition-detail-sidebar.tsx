"use client";

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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <Box className="size-4" />
          {t("detail.relatedObject")}
        </h2>

        {exhibition.collectionId ? (
          <div className="group relative rounded-lg border border-border bg-background/50 p-4 transition-all hover:border-border hover:bg-muted/50">
            <Link
              href={`/collections/${exhibition.collectionId}`}
              className="absolute inset-0 z-10"
            />
            <h3 className="truncate font-medium text-foreground group-hover:text-white">
              {exhibition.collectionTitle || t("detail.unknownObject")}
            </h3>
            <div className="mt-2 flex items-center text-xs text-muted-foreground group-hover:text-muted-foreground">
              {t("detail.viewObjectDetails")}{" "}
              <ArrowLeft className="ml-1 size-3 rotate-180" />
            </div>
          </div>
        ) : null}
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
