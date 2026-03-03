"use client";

import { useOrganization } from "@/components/organization-provider";
import { SidebarTrigger } from "@v1/ui/sidebar";
import { Building2 } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function DashboardHeader({ children }: { children: ReactNode }) {
  const { currentOrganization } = useOrganization();
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale as string;

  const getPageTitle = (path: string) => {
    const cleanPath = path.replace(`/${locale}`, "") || "/";

    if (cleanPath === "/" || cleanPath === "") return "Collections Overview";
    if (cleanPath.startsWith("/objects")) return "Object Catalog";
    if (cleanPath.startsWith("/exhibitions")) return "Exhibition Management";

    const segment = cleanPath.split("/").pop();
    return segment
      ? segment.charAt(0).toUpperCase() + segment.slice(1)
      : "Overview";
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2 text-xs ml-2">
          <span className="text-muted-foreground flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            {currentOrganization?.name ?? "MuseumLite"}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-medium text-foreground">
            {getPageTitle(pathname)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {children}
      </div>
    </header>
  );
}
