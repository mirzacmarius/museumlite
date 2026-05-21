"use client";

import { Button } from "@v1/ui/button";
import { Printer } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

interface BoardReportPrintActionsProps {
  onClose: () => void;
}

export function BoardReportPrintActions({
  onClose,
}: BoardReportPrintActionsProps) {
  const t = useScopedI18n("deaccessions");

  return (
    <div className="flex flex-shrink-0 justify-end gap-2 border-t border-zinc-200 bg-white p-6 pt-4 print:hidden">
      <Button variant="outline" onClick={onClose}>
        {t("actions.close")}
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="mr-2 size-4" />
        {t("actions.print")}
      </Button>
    </div>
  );
}
