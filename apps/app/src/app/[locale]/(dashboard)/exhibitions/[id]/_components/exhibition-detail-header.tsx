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
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href="/exhibitions">
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="text-muted-foreground">{t("title")}</span>
        <span className="text-muted-foreground">/</span>
        <span className="max-w-[200px] truncate font-medium text-foreground">
          {exhibition.title}
        </span>
      </div>

      <div className="flex items-center gap-2">
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
