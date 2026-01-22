"use client";

import Link from "next/link";

export type RecentActivityItem = {
  type: "collection" | "loan" | "accession" | "deaccession";
  id: string;
  title: string;
  subtitle?: string;
  timestamp: number;
  status?: string;
};

function getActionText(
  type: RecentActivityItem["type"],
  status?: string,
): string {
  switch (type) {
    case "collection":
      if (status === "loaned") return "Loaned Out";
      if (status === "deaccessioned") return "Deaccessioned";
      return "Added to Catalog";
    case "loan":
      if (status === "active") return "Loan Active";
      if (status === "returned") return "Loan Returned";
      if (status === "pending") return "Loan Requested";
      return "Loan Updated";
    case "accession":
      if (status === "approved") return "Accession Approved";
      if (status === "rejected") return "Accession Rejected";
      return "Accession Received";
    case "deaccession":
      if (status === "approved") return "Deaccession Approved";
      if (status === "rejected") return "Deaccession Rejected";
      return "Deaccession Proposed";
    default:
      return "Activity";
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getActivityBadgeColor(type: RecentActivityItem["type"]): string {
  switch (type) {
    case "collection":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
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
  title = "Recent Activity Log",
  showHeader = true,
}: RecentActivityLogProps) {
  return (
    <div className="mt-8">
      {showHeader && (
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-3 font-medium">Object / Collection</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activities.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No recent activity
                </td>
              </tr>
            ) : (
              activities.map((activity) => {
                const href = getActivityLink(activity.type, activity.id);

                return (
                  <tr
                    key={`${activity.type}-${activity.id}`}
                    className="hover:bg-muted/40 transition-colors group"
                  >
                    <td className="p-0">
                      <Link
                        href={href}
                        className="flex items-center gap-2 px-4 py-3 text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        aria-label={`View ${activity.type}: ${activity.title}`}
                      >
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                          {getInitials(activity.type)}
                        </div>
                        {activity.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border ${getActivityBadgeColor(activity.type)}`}
                      >
                        {getActionText(activity.type, activity.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">System</td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono text-[10px]">
                      {formatRelativeTime(activity.timestamp)}
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
