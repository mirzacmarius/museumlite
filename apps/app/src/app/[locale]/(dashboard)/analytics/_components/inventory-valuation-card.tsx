"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { DollarSign } from "lucide-react";
import { useI18n } from "@/locales/client";

interface ValuationSourceCounts {
  itemCount: number | null;
  valuedCount: number | null;
}

interface InventoryValuationCardProps {
  data: {
    fineArt: ValuationSourceCounts;
    wine: ValuationSourceCounts;
    vehicles: ValuationSourceCounts;
  };
}

export function InventoryValuationCard({ data }: InventoryValuationCardProps) {
  const t = useI18n();
  const sources = [
    { label: t("analytics.inventory.fineArt"), counts: data.fineArt },
    { label: t("analytics.inventory.wine"), counts: data.wine },
    { label: t("analytics.inventory.vehicles"), counts: data.vehicles },
  ];
  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <DollarSign className="size-4" />
          {t("analytics.inventory.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>{t("analytics.inventory.unavailable")}</p>
        <p className="text-xs">{t("analytics.inventory.sourceCounts")}</p>
        <dl className="space-y-2">
          {sources.map(({ label, counts }) => (
            <div key={label} className="flex justify-between gap-2">
              <dt>{label}</dt>
              <dd>
                {counts.itemCount ?? "—"} / {counts.valuedCount ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
