import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import { NotificationBell } from "@/components/notification-bell";
import { OrganizationProvider } from "@/components/organization-provider";
import { PermissionProvider } from "@/components/permission-gate";
import { SkipNavigation } from "@/components/skip-navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import { SidebarProvider } from "@v1/ui/sidebar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { DashboardHeader } from "./dashboard-header";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await convexAuthNextjsToken();
  const [user, organizations] = await Promise.all([
    fetchQuery(api.users.getUser, {}, { token }),
    fetchQuery(api.organizations.listUserOrganizations, {}, { token }),
  ]);

  if (!user?.username || !organizations || organizations.length === 0) {
    return redirect("/onboarding");
  }
  const [preloadedUser, preloadedProducts] = await Promise.all([
    preloadQuery(api.users.getUser, {}, { token }),
    preloadQuery(api.subscriptions.listAllProducts, {}, { token }),
  ]);
  return (
    <OrganizationProvider>
      <PermissionProvider>
        <CommandPaletteProvider>
          <KeyboardShortcutsProvider>
            <SidebarProvider>
              <SkipNavigation />
              <NavigationProgress />
              <AppSidebar
                preloadedUser={preloadedUser}
                preloadedProducts={preloadedProducts}
              />
              <main className="flex min-h-screen w-full flex-col bg-background">
                <DashboardHeader>
                  <div id="search" className="flex items-center gap-2">
                    <CommandPalette />
                    <NotificationBell />
                  </div>
                </DashboardHeader>
                <div id="main-content" className="flex-1">
                  {children}
                </div>
              </main>
              <Analytics />
              <SpeedInsights />
            </SidebarProvider>
          </KeyboardShortcutsProvider>
        </CommandPaletteProvider>
      </PermissionProvider>
    </OrganizationProvider>
  );
}
