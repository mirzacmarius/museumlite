import type { api } from "@v1/backend/convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@v1/ui/sidebar";
import { Skeleton } from "@v1/ui/skeleton";
import type { Preloaded } from "convex/react";
import { Suspense } from "react";
import { AppSidebarClient } from "./app-sidebar-client";

const SIDEBAR_SKELETON_KEYS = [
  "nav-skeleton-1",
  "nav-skeleton-2",
  "nav-skeleton-3",
  "nav-skeleton-4",
  "nav-skeleton-5",
  "nav-skeleton-6",
  "nav-skeleton-7",
  "nav-skeleton-8",
] as const;

function AppSidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 pb-1 pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <Skeleton className="h-10 w-full rounded-md" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-2 px-2 py-1">
        {SIDEBAR_SKELETON_KEYS.map((skeletonKey) => (
          <Skeleton
            key={skeletonKey}
            className="h-7 w-full rounded-md"
          />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppSidebar({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
}) {
  return (
    <Suspense fallback={<AppSidebarFallback />}>
      <AppSidebarClient preloadedUser={preloadedUser} />
    </Suspense>
  );
}
