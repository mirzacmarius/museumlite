"use client";

import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { Badge } from "@v1/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { Calendar, MapPin, Presentation } from "lucide-react";
import { StackedBar } from "./stacked-bar";

interface ExhibitionPipelineCardProps {
  data: {
    proposed: number;
    approved: number;
    active: number;
    closed: number;
    rejected: number;
    upcomingStarts: Array<{
      id: string;
      title: string;
      location?: string;
      startDate: number;
      daysUntilStart: number;
      status?: string;
    }>;
    activeNow: Array<{
      id: string;
      title: string;
      location?: string;
      startDate: number;
      endDate?: number;
    }>;
  };
}

export function ExhibitionPipelineCard({ data }: ExhibitionPipelineCardProps) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const chartData = [
    {
      label: t("analytics.exhibitions.active"),
      value: data.active,
      color: "bg-emerald-500",
    },
    {
      label: t("analytics.exhibitions.approved"),
      value: data.approved,
      color: "bg-blue-500",
    },
    {
      label: t("analytics.exhibitions.proposed"),
      value: data.proposed,
      color: "bg-amber-500",
    },
    {
      label: t("analytics.exhibitions.closed"),
      value: data.closed,
      color: "bg-muted-foreground/30",
    },
  ];

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Presentation className="w-4 h-4" />
          {t("analytics.exhibitions.title")}
        </CardTitle>
        <div className="mt-4 space-y-3">
          <StackedBar data={chartData} height="h-2" />
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 hover:bg-emerald-500/20"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {data.active} {t("analytics.exhibitions.active")}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 hover:bg-blue-500/20"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {data.approved} {t("analytics.exhibitions.approved")}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 hover:bg-amber-500/20"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {data.proposed} {t("analytics.exhibitions.proposed")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-6">
        {data.activeNow.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-emerald-500 mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {t("analytics.exhibitions.activeNow")}
            </h4>
            <div className="space-y-3">
              {data.activeNow.map((exh) => (
                <div
                  key={exh.id}
                  className="group relative pl-3 border-l-2 border-emerald-500/30 hover:border-emerald-500 transition-colors cursor-default"
                >
                  <h5 className="text-sm font-medium text-foreground truncate">
                    {exh.title}
                  </h5>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    {exh.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {exh.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            {t("analytics.exhibitions.upcomingStarts")}
          </h4>
          <div className="space-y-3">
            {data.upcomingStarts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("analytics.exhibitions.noUpcoming")}
              </p>
            ) : (
              data.upcomingStarts.map((exh) => (
                <div
                  key={exh.id}
                  className="flex items-start justify-between group cursor-default p-2 rounded-md hover:bg-muted/30 -mx-2 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <h5 className="text-sm font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">
                      {exh.title}
                    </h5>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{" "}
                        {formatDate(new Date(exh.startDate), locale)}
                      </span>
                      {exh.location && <span>• {exh.location}</span>}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 font-mono text-[10px] bg-blue-500/5 border-blue-500/20 text-blue-500 whitespace-nowrap"
                  >
                    {t("analytics.exhibitions.startsIn")} {exh.daysUntilStart}
                    {t("analytics.exhibitions.days").charAt(0)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
