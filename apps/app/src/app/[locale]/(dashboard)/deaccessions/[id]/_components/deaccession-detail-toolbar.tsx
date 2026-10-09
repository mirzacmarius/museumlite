"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useBackToResultsLink } from "@/components/record-recovery-state";
import { useScopedI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

export function DeaccessionDetailToolbar({
  setIsPrintModalOpen,
}: Pick<DeaccessionDetailViewProps, "setIsPrintModalOpen">) {
  const t = useScopedI18n("deaccessions");
  const back = useBackToResultsLink("deaccessions");

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href={back.href}>
          <ArrowLeft className="mr-2 size-4" />
          {back.fromResults ? back.label : t("actions.backToDeaccessions")}
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsPrintModalOpen(true)}
        className="border-border/70 bg-card/70 backdrop-blur"
      >
        <Printer className="mr-2 size-4" />
        {t("actions.boardReport")}
      </Button>
    </div>
  );
}
