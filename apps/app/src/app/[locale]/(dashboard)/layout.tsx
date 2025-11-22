import { AppSidebar } from "@/components/app-sidebar";
import { OrganizationProvider } from "@/components/organization-provider";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@v1/backend/convex/_generated/api";
import { SidebarProvider, SidebarTrigger } from "@v1/ui/sidebar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: { children: React.ReactNode }) {
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
    <OrganizationProvider>
      <SidebarProvider>
        <AppSidebar preloadedUser={preloadedUser} preloadedProducts={preloadedProducts} />
        <main className="min-h-[100vh] w-full bg-secondary dark:bg-black">
          <div className="flex items-center p-4">
            <SidebarTrigger />
          </div>
          {children}
        </main>
        <Analytics />
        <SpeedInsights />
      </SidebarProvider>
    </OrganizationProvider>
  );
}
