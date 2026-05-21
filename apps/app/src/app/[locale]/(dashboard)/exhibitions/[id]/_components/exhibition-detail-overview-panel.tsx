"use client";

import { Calendar, GalleryVerticalEnd, Info, MapPin } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { useScopedI18n } from "@/locales/client";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailOverviewPanel({
  exhibition,
  locale,
}: Pick<ExhibitionDetailViewProps, "exhibition" | "locale">) {
  const t = useScopedI18n("exhibitions");

  return (
    <>
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <GalleryVerticalEnd className="size-4" />
          {t("detail.overview")}
        </h2>

        <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.location")}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <MapPin className="size-3.5 text-muted-foreground" />
              {exhibition.location || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.dateRange")}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <Calendar className="size-3.5 text-muted-foreground" />
              <ClientDate timestamp={exhibition.startDate} locale={locale} />
              {exhibition.endDate ? (
                <>
                  {" — "}
                  <ClientDate timestamp={exhibition.endDate} locale={locale} />
                </>
              ) : (
                ` ${t("card.ongoing")}`
              )}
            </p>
          </div>

          {exhibition.isLoan ? (
            <div className="md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("detail.loanVenue")}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {exhibition.loanVenue || "—"}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <h2 className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <Info className="size-4" />
          {t("detail.notes")}
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {exhibition.notes || t("detail.noNotes")}
        </p>
      </div>
    </>
  );
}
