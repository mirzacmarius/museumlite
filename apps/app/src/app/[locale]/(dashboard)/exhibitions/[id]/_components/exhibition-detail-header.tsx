"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailHeader({
  exhibitionId,
  exhibition,
}: Pick<ExhibitionDetailViewProps, "exhibitionId" | "exhibition">) {
  const t = useScopedI18n("exhibitions");

  return (
    <header className="sticky top-0 z-50 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
          <Link href="/exhibitions" aria-label={t("title")} title={t("title")}>
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="hidden text-muted-foreground sm:inline">
          {t("title")}
        </span>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <span className="min-w-0 truncate font-medium text-foreground sm:max-w-[200px]">
          {exhibition.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <PermissionGate permission="collections.update">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-border text-foreground/80 hover:bg-muted hover:text-white"
          >
            <Link href={`/exhibitions/${exhibitionId}/edit`}>
              <Pencil className="mr-2 size-3.5" />
              {t("actions.edit")}
            </Link>
          </Button>
        </PermissionGate>
      </div>
    </header>
  );
}
