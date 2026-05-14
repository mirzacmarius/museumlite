"use client";

import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { Box, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface Exhibition {
  _id: string;
  title: string;
  location?: string;
  notes?: string;
  collectionTitle?: string;
  startDate: number;
  endDate?: number;
  isLoan?: boolean;
  isCurrent?: boolean;
}

interface ExhibitionTimelineProps {
  exhibitions: Exhibition[];
}

export function ExhibitionTimeline({ exhibitions }: ExhibitionTimelineProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions");

  const groupedByYear = useMemo(() => {
    const groups: Record<string, Exhibition[]> = {};

    for (const ex of exhibitions) {
      const year = new Date(ex.startDate).getFullYear().toString();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(ex);
    }

    const sortedYears = Object.keys(groups).sort(
      (a, b) => Number(b) - Number(a),
    );

    return sortedYears.map((year) => ({
      year,
      exhibitions: (groups[year] ?? []).sort(
        (a, b) => b.startDate - a.startDate,
      ),
    }));
  }, [exhibitions]);

  const getExhibitionStatus = (ex: Exhibition) => {
    const now = Date.now();
    if (ex.endDate && ex.endDate < now) {
      return {
        status: t("status.past"),
        color: "bg-muted",
        textColor: "text-muted-foreground",
      };
    }
    if (ex.startDate > now) {
      return {
        status: t("status.upcoming"),
        color: "bg-blue-500/20",
        textColor: "text-blue-400",
      };
    }
    return {
      status: t("status.current"),
      color: "bg-emerald-500/20",
      textColor: "text-emerald-400",
    };
  };

  return (
    <div className="relative space-y-8 pl-4">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />

      {groupedByYear.map(({ year, exhibitions }) => (
        <div key={year} className="relative">
          <div className="absolute -left-4 flex items-center">
            <div className="size-3 rounded-full bg-primary border-2 border-background" />
          </div>
          <div className="mb-4 ml-4">
            <h3 className="text-lg font-semibold text-foreground">{year}</h3>
          </div>

          <div className="ml-4 space-y-4">
            {exhibitions.map((ex) => {
              const { status, color, textColor } = getExhibitionStatus(ex);

              return (
                <Link
                  key={ex._id}
                  href={`/exhibitions/${ex._id}`}
                  className="group relative block rounded-lg border border-border bg-card p-4 transition-all hover:bg-muted/80 hover:border-border hover:shadow-lg hover:shadow-black/20"
                >
                  <div className="absolute -left-8 top-1/2 h-0.5 w-4 bg-border" />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`rounded-full ${color} px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${textColor}`}
                        >
                          {status}
                        </span>
                        {ex.isLoan && (
                          <span className="text-[10px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                            {t("status.loan")}
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-foreground group-hover:text-white line-clamp-1">
                        {ex.title}
                      </h4>

                      {ex.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {ex.location}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3.5" />
                        <span>
                          {formatDate(new Date(ex.startDate), locale, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {ex.endDate && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          —{" "}
                          {formatDate(new Date(ex.endDate), locale, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {ex.collectionTitle && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                      <Box className="size-3.5" />
                      <span className="truncate">{ex.collectionTitle}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
