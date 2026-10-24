"use client";

import { useScopedI18n } from "@/locales/client";

/** A structured date as EDTF, for staff who check what exports carry. */
export function EdtfChip({ edtf }: { edtf: string }) {
  const t = useScopedI18n("objects.form.productionDate");
  return (
    <span className="inline-flex items-center rounded-md border border-border/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {t("edtf", { edtf })}
    </span>
  );
}
