import type { api } from "@v1/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { AppSidebarClient } from "./app-sidebar-client";

export function AppSidebar({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
}) {
  return <AppSidebarClient preloadedUser={preloadedUser} />;
}
