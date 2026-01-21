"use client";

import { formatCurrency as formatCurrencyUtil } from "@/lib/format-number";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { Separator } from "@v1/ui/separator";
import { Car, DollarSign, Palette, Wine } from "lucide-react";
import { StackedBar } from "./stacked-bar";

interface InventoryValuationCardProps {
  data: {
    totalValue: number;
    fineArt: { totalValue: number; itemCount: number; valuedCount: number };
    wine: { totalValue: number; itemCount: number; valuedCount: number };
    vehicles: { totalValue: number; itemCount: number; valuedCount: number };
  };
}

export function InventoryValuationCard({ data }: InventoryValuationCardProps) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const formatCurrency = (value: number) =>
    formatCurrencyUtil(value, locale, "USD").replace(/\.\d+$/, "");

  const chartData = [
    {
      label: t("analytics.inventory.fineArt"),
      value: data.fineArt.totalValue,
      color: "bg-indigo-500",
    },
    {
      label: t("analytics.inventory.wine"),
      value: data.wine.totalValue,
      color: "bg-amber-500",
    },
    {
      label: t("analytics.inventory.vehicles"),
      value: data.vehicles.totalValue,
      color: "bg-emerald-500",
    },
  ];

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          {t("analytics.inventory.title")}
        </CardTitle>
        <div className="mt-2">
          <div className="text-3xl font-bold text-foreground">
            {formatCurrency(data.totalValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total appraised value across{" "}
            {data.fineArt.itemCount +
              data.wine.itemCount +
              data.vehicles.itemCount}{" "}
            items
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end gap-6">
        <StackedBar data={chartData} height="h-3" />

        <div className="space-y-4">
          <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  Fine Art
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data.fineArt.itemCount} items
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">
                {formatCurrency(data.fineArt.totalValue)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {(
                  (data.fineArt.totalValue / data.totalValue) * 100 || 0
                ).toFixed(1)}
                %
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                <Wine className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Wine</div>
                <div className="text-[10px] text-muted-foreground">
                  {data.wine.itemCount} items
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">
                {formatCurrency(data.wine.totalValue)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {((data.wine.totalValue / data.totalValue) * 100 || 0).toFixed(
                  1,
                )}
                %
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  Vehicles
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data.vehicles.itemCount} items
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">
                {formatCurrency(data.vehicles.totalValue)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {(
                  (data.vehicles.totalValue / data.totalValue) * 100 || 0
                ).toFixed(1)}
                %
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
