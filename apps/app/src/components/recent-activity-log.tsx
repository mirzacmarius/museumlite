"use client";

import Link from "next/link";
import { formatDistanceLocale } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";

export type RecentActivityItem = {
  type: "collection" | "loan" | "accession" | "deaccession";
  id: string;
  entityId?: string;
  title: string;
  subtitle?: string;
  timestamp: number;
  status?: string;
};

function getActionText(
  type: RecentActivityItem["type"],
  status: string | undefined,
  translate: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (type) {
    case "collection":
      if (status === "loaned")
        return translate("untranslatedComponents.activity.loanedOut");
      if (status === "deaccessioned")
        return translate("untranslatedComponents.activity.deaccessioned");
      return translate("untranslatedComponents.activity.addedToCatalog");
    case "loan":
      if (status === "active")
        return translate("untranslatedComponents.activity.loanActive");
      if (status === "returned")
        return translate("untranslatedComponents.activity.loanReturned");
      if (status === "pending")
        return translate("untranslatedComponents.activity.loanRequested");
      return translate("untranslatedComponents.activity.loanUpdated");
    case "accession":
      if (status === "approved")
        return translate("untranslatedComponents.activity.accessionApproved");
      if (status === "rejected")
        return translate("untranslatedComponents.activity.accessionRejected");
      return translate("untranslatedComponents.activity.accessionReceived");
    case "deaccession":
      if (status === "approved")
        return translate("untranslatedComponents.activity.deaccessionApproved");
      if (status === "rejected")
        return translate("untranslatedComponents.activity.deaccessionRejected");
      return translate("untranslatedComponents.activity.deaccessionProposed");
    default:
      return translate("untranslatedComponents.activity.activity");
  }
}

function formatRelativeTime(timestamp: number, locale: string): string {
  return formatDistanceLocale(new Date(timestamp), locale, { addSuffix: true });
}

function getActivityBadgeColor(type: RecentActivityItem["type"]): string {
  switch (type) {
    case "collection":
      return "bg-primary/10 text-primary border-primary/20";
    case "loan":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "accession":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "deaccession":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getActivityLink(type: RecentActivityItem["type"], id: string): string {
  switch (type) {
    case "collection":
      return `/objects/${id}`;
    case "loan":
      return `/loans/${id}`;
    case "accession":
      return `/accessions/${id}`;
    case "deaccession":
      return `/deaccessions/${id}`;
    default:
      return "#";
  }
}

function getInitials(type: RecentActivityItem["type"]): string {
  switch (type) {
    case "collection":
      return "OB";
    case "loan":
      return "LN";
    case "accession":
      return "AC";
    case "deaccession":
      return "DA";
    default:
      return "??";
  }
}

interface RecentActivityLogProps {
  activities: RecentActivityItem[];
  title?: string;
  showHeader?: boolean;
}

export function RecentActivityLog({
  activities,
  title,
  showHeader = true,
}: RecentActivityLogProps) {
  const translate = useI18n();
  const locale = useCurrentLocale();
  return (
    <div className="mt-8">
      {showHeader && (
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
          {title ??
            translate("untranslatedComponents.activity.recentActivityLog")}
        </h3>
      )}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
            <tr>
              <th className="px-4 py-3 font-medium">
                {translate("untranslatedComponents.labels.objectCollection")}
              </th>
              <th className="px-4 py-3 font-medium">
                {translate("untranslatedComponents.labels.action")}
              </th>
              <th className="px-4 py-3 font-medium">
                {translate("untranslatedComponents.labels.user")}
              </th>
              <th className="px-4 py-3 font-medium text-right">
                {translate("untranslatedComponents.labels.time")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {activities.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {translate("untranslatedComponents.labels.noRecentActivity")}
                </td>
              </tr>
            ) : (
              activities.map((activity) => {
                const href = getActivityLink(
                  activity.type,
                  activity.entityId ?? activity.id,
                );

                return (
                  <tr
                    key={activity.id}
                    className="hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-0">
                      <Link
                        href={href}
                        className="flex items-center gap-2 px-4 py-3 text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        aria-label={translate(
                          "untranslatedComponents.activity.viewActivity",
                          { type: activity.type, title: activity.title },
                        )}
                      >
                        <div className="size-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">
                          {getInitials(activity.type)}
                        </div>
                        {activity.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border ${getActivityBadgeColor(activity.type)}`}
                      >
                        {getActionText(
                          activity.type,
                          activity.status,
                          translate,
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {translate("untranslatedComponents.labels.system")}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 font-mono text-[10px]">
                      {formatRelativeTime(activity.timestamp, locale)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
