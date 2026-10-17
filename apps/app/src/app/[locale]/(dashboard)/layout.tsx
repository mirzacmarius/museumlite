import { api } from "@v1/backend/convex/_generated/api";
import { SidebarInset, SidebarProvider } from "@v1/ui/sidebar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { NotificationBell } from "@/components/notification-bell";
import { OrganizationProvider } from "@/components/organization-provider";
import { PermissionProvider } from "@/components/permission-gate";
import { SkipNavigation } from "@/components/skip-navigation";
import { getConvexServerToken } from "@/lib/convex-server-token";
import { DashboardHeader } from "./dashboard-header";
import { DashboardShellSkeleton } from "./dashboard-shell-skeleton";

export default function Layout({ children }: { children: ReactNode }) {
  // The shell reads the session, so it streams in behind a skeleton. Client
  // navigations inside the dashboard keep this layout mounted and only render
  // the page below it.
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

async function DashboardShell({ children }: { children: ReactNode }) {
  const token = await getConvexServerToken();
  const [user, organizations, activeOrgPreference] = await Promise.all([
    fetchQuery(api.users.getUser, {}, { token }),
    fetchQuery(api.organizations.listUserOrganizations, {}, { token }),
    fetchQuery(
      api.userPreferences.get,
      { key: "organization.activeOrgId" },
      { token },
    ),
  ]);

  if (!user?.username || !organizations || organizations.length === 0) {
    return redirect("/onboarding");
  }
  const preloadedUser = await preloadQuery(api.users.getUser, {}, { token });
  return (
    <OrganizationProvider
      initialOrganizations={organizations}
      initialActiveOrgPreference={activeOrgPreference}
    >
      <PermissionProvider>
        <CommandPaletteProvider>
          <KeyboardShortcutsProvider>
            <SidebarProvider>
              <SkipNavigation />
              <AppSidebar preloadedUser={preloadedUser} />
              <SidebarInset className="h-svh min-w-0 overflow-hidden">
                <DashboardHeader>
                  <div id="search" className="flex items-center gap-2">
                    <CommandPalette />
                    <NotificationBell />
                  </div>
                </DashboardHeader>
                <div
                  id="main-content"
                  className="min-h-0 flex-1 overflow-hidden"
                >
                  {children}
                </div>
              </SidebarInset>
              <Analytics />
              <SpeedInsights />
            </SidebarProvider>
          </KeyboardShortcutsProvider>
        </CommandPaletteProvider>
      </PermissionProvider>
    </OrganizationProvider>
  );
}
