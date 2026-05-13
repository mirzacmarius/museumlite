"use client";

import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarSeparator,
} from "@v1/ui/sidebar";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { ImageOff, Pencil, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatOwnershipDateRange } from "./format-ownership-date-range";

interface RecordContextSidebarProps {
  collectionId: string;
  tags?: string[];
  organizationId: Id<"organizations">;
  heroImageUrl?: string | null;
  condition?: string | null;
  valuation?: number | null;
  provenance?: string | null;
  ownershipHistory?: Array<{
    owner: string;
    startYear?: string;
    endYear?: string;
    verified?: boolean;
  }>;
  verified?: boolean;
  verifiedByName?: string;
}

export function RecordContextSidebar({
  collectionId,
  tags,
  organizationId,
  heroImageUrl,
  condition,
  valuation,
  provenance,
  ownershipHistory,
  verified,
  verifiedByName,
}: RecordContextSidebarProps) {
  const locale = useCurrentLocale();

  // Query for related objects (same collection group or parent/child)
  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  const childObjects = useQuery(
    api.collections.getChildObjects,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  const parentObject = useQuery(
    api.collections.getParentObjectWithThumbnail,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  // Query for recent activity (audit log for this collection)
  const recentActivity = useQuery(
    api.auditLog.getByEntity,
    collectionId
      ? {
          organizationId,
          entityType: "collection",
          entityId: collectionId,
          limit: 5,
        }
      : "skip",
  );

  // Get primary media for related objects
  const relatedObjects: Array<{
    _id: string;
    title: string;
    accessionNumber: string;
    thumbnailUrl?: string | null;
    relationship: string;
  }> = [
    ...(parentObject
      ? [{ ...parentObject, relationship: "Parent" as const }]
      : []),
    ...(childObjects?.map((c) => ({
      ...c,
      relationship: "Child" as const,
    })) ?? []),
  ];

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="none"
      className="hidden w-96 shrink-0 border-l border-border/60 bg-background 2xl:flex"
    >
      <SidebarHeader className="border-b border-border/60 p-4">
        <h3 className="text-xs font-medium text-foreground">Record Context</h3>
        <p className="text-[10px] text-muted-foreground">
          History and related items
        </p>
      </SidebarHeader>

      {heroImageUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
          <img
            src={heroImageUrl}
            alt="Object"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <SidebarContent className="p-4">
        <SidebarGroup className="p-0 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                Condition
              </p>
              <p className="text-xs font-medium text-foreground">
                {condition || "Not assessed"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                Valuation
              </p>
              <p className="text-xs font-medium text-foreground">
                {valuation ? formatCurrency(valuation, locale, "USD") : "—"}
              </p>
            </div>
          </div>
        </SidebarGroup>

        {(provenance || (ownershipHistory && ownershipHistory.length > 0)) && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="mb-3 h-auto p-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Provenance
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {ownershipHistory && ownershipHistory.length > 0 ? (
                <div className="space-y-2">
                  {ownershipHistory.slice(0, 4).map((entry) => (
                    <div
                      key={`${entry.owner}-${entry.startYear}`}
                      className="flex items-start gap-2 text-xs"
                    >
                      <div
                        className={cn(
                          "mt-1.5 size-1.5 rounded-full shrink-0",
                          entry.verified
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/50",
                        )}
                      />
                      <div>
                        <p className="text-foreground">{entry.owner}</p>
                        {formatOwnershipDateRange(entry, {
                          presentLabel: "Present",
                          separator: "–",
                        }) ? (
                          <p className="text-[10px] text-muted-foreground">
                            {formatOwnershipDateRange(entry, {
                              presentLabel: "Present",
                              separator: "–",
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {provenance}
                </p>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(provenance || (ownershipHistory && ownershipHistory.length > 0)) && (
          <SidebarSeparator className="my-4" />
        )}

        {/* Tags Section */}
        {tags && tags.length > 0 && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="mb-3 h-auto p-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Tags
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="cursor-pointer rounded border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {tags && tags.length > 0 && <SidebarSeparator className="my-4" />}

        {/* Related Objects Section */}
        {relatedObjects.length > 0 && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="mb-3 h-auto p-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Related Objects ({relatedObjects.length})
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-wrap gap-2">
                {relatedObjects.map((obj) => (
                  <Link
                    key={obj._id}
                    href={`/objects/${obj._id}`}
                    className="group flex items-center gap-2 rounded-full border border-border bg-background/50 py-1 pl-1 pr-3 transition-all hover:border-accent hover:bg-accent/5"
                  >
                    <Avatar className="h-8 w-8 ring-1 ring-border group-hover:ring-accent">
                      <AvatarImage
                        src={obj.thumbnailUrl ?? undefined}
                        alt={obj.title}
                      />
                      <AvatarFallback className="bg-secondary text-[10px]">
                        <ImageOff className="h-3 w-3 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {obj.title.split(" ").slice(0, 2).join(" ")}
                        {obj.title.split(" ").length > 2 && "..."}
                      </p>
                      <p className="text-[10px] text-accent">
                        {obj.relationship}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {relatedObjects.length > 0 && <SidebarSeparator className="my-4" />}

        {/* Recent Activity Section */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-3 h-auto p-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Recent Activity
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="relative space-y-6 border-l border-border/60 pl-3">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={activity._id} className="group relative">
                    <div
                      className={cn(
                        "absolute -left-[17px] top-1 size-2 rounded-full ring-4 ring-background transition-colors",
                        index === 0
                          ? "bg-accent"
                          : "bg-muted-foreground/50 group-hover:bg-muted-foreground",
                      )}
                    />
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="text-foreground">
                          {activity.action}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatRelativeTime(activity.timestamp, locale)}
                        {activity.userName && ` • ${activity.userName}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No recent activity
                </p>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-3">
        {verified && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <div className="flex-1">
              <p className="text-[10px] font-medium text-indigo-200">
                Record Verified
              </p>
              <p className="text-[9px] text-indigo-300/60">
                Approved by {verifiedByName || "Curator"}
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            asChild
          >
            <Link href={`/objects/${collectionId}/edit`}>
              <Pencil className="mr-1.5 h-3 w-3" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Share2 className="mr-1.5 h-3 w-3" />
            Share
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function formatRelativeTime(timestamp: number, locale: string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatDate(new Date(timestamp), locale, {
    month: "short",
    day: "numeric",
  });
}
