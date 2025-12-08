"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { useQuery } from "convex/react";
import { ImageOff, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface RecordContextSidebarProps {
  collectionId: string;
  tags?: string[];
  organizationId: Id<"organizations">;
}

export function RecordContextSidebar({
  collectionId,
  tags,
  organizationId,
}: RecordContextSidebarProps) {
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
    api.collections.getParentObject,
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
  const relatedObjects = [
    ...(parentObject ? [{ ...parentObject, relationship: "Parent" }] : []),
    ...(childObjects?.map((c) => ({ ...c, relationship: "Child" })) ?? []),
  ];

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="none"
      className="hidden w-80 shrink-0 border-l border-border/60 bg-background 2xl:flex"
    >
      <SidebarHeader className="border-b border-border/60 p-4">
        <h3 className="text-xs font-medium text-foreground">Record Context</h3>
        <p className="text-[10px] text-muted-foreground">
          History and related items
        </p>
      </SidebarHeader>

      <SidebarContent className="p-4">
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
                    className="cursor-pointer rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
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
              <div className="space-y-2">
                {relatedObjects.map((obj) => (
                  <Link
                    key={obj._id}
                    href={`/objects/${obj._id}`}
                    className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-secondary">
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                        {obj.title}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {obj.accessionNumber}
                      </p>
                      <p className="mt-0.5 text-[10px] text-accent">
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
                      className={`absolute -left-[17px] top-1 h-2 w-2 rounded-full ring-4 ring-background ${
                        index === 0 ? "bg-accent" : "bg-muted-foreground/50"
                      }`}
                    />
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="text-foreground">{activity.action}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatRelativeTime(activity.timestamp)} 
                        {activity.userName && ` by ${activity.userName}`}
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
        <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/10 p-2">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <div className="flex-1">
            <p className="text-[10px] font-medium text-accent">
              Record Verified
            </p>
            <p className="text-[9px] text-accent/60">Approved by Curator</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
