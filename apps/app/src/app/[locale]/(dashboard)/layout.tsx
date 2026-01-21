import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
import { NotificationBell } from "@/components/notification-bell";
import { OrganizationProvider } from "@/components/organization-provider";
import { PermissionProvider } from "@/components/permission-gate";
import { I18nProviderClient } from "@/locales/client";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import { SidebarProvider, SidebarTrigger } from "@v1/ui/sidebar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await fetchQuery(
    api.users.getUser,
    {},
    { token: await convexAuthNextjsToken() },
  );
  if (!user?.username) {
    return redirect("/onboarding");
  }
  const preloadedUser = await preloadQuery(
    api.users.getUser,
    {},
    { token: await convexAuthNextjsToken() },
  );
  const preloadedProducts = await preloadQuery(
    api.subscriptions.listAllProducts,
    {},
    { token: await convexAuthNextjsToken() },
  );
  return (
    <I18nProviderClient locale={locale}>
      <OrganizationProvider>
        <PermissionProvider>
          <CommandPaletteProvider>
            <SidebarProvider>
              <AppSidebar
                preloadedUser={preloadedUser}
                preloadedProducts={preloadedProducts}
              />
              <main className="flex min-h-screen w-full flex-col bg-background">
                <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
                  <SidebarTrigger className="-ml-1" />
                  <div className="flex items-center gap-2">
                    <CommandPalette />
                    <NotificationBell />
                  </div>
                </header>
                <div className="flex-1">{children}</div>
              </main>
              <Analytics />
              <SpeedInsights />
            </SidebarProvider>
          </CommandPaletteProvider>
        </PermissionProvider>
      </OrganizationProvider>
    </I18nProviderClient>
  );
}
