"use client";

import { useScopedI18n } from "@/locales/client";
import { BookOpen } from "lucide-react";
import type { CatalogItemDetailViewProps } from "./catalog-item-detail-view-props";

export function CatalogItemDetailSidebar({
  item,
}: Pick<CatalogItemDetailViewProps, "item">) {
  const tDetail = useScopedI18n("library.catalog.detail");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card">
        <div className="p-6">
          {item.coverImageUrl ? (
            <img
              src={item.coverImageUrl}
              alt={item.title}
              className="w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-muted">
              <BookOpen className="size-16 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-medium">{tDetail("circulation")}</h2>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <p className="text-sm text-muted-foreground">
              {tDetail("canCirculate")}
            </p>
            <p className="font-medium">
              {item.isCirculating
                ? tDetail("canCirculateYes")
                : tDetail("canCirculateNo")}
            </p>
          </div>
          {item.loanPeriodDays ? (
            <div>
              <p className="text-sm text-muted-foreground">
                {tDetail("loanPeriod")}
              </p>
              <p className="font-medium">
                {tDetail("loanPeriodDays", { days: item.loanPeriodDays })}
              </p>
            </div>
          ) : null}
          {item.maxRenewals ? (
            <div>
              <p className="text-sm text-muted-foreground">
                {tDetail("maxRenewals")}
              </p>
              <p className="font-medium">{item.maxRenewals}</p>
            </div>
          ) : null}
        </div>
      </div>

      {item.notes || item.internalNotes ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-medium">{tDetail("notes")}</h2>
          </div>
          <div className="space-y-4 p-6">
            {item.notes ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("publicNotes")}
                </p>
                <p className="text-sm">{item.notes}</p>
              </div>
            ) : null}
            {item.internalNotes ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("internalNotes")}
                </p>
                <p className="text-sm">{item.internalNotes}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
