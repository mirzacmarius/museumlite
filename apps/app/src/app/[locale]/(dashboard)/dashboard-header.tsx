"use client";

import { Separator } from "@v1/ui/separator";
import { SidebarTrigger } from "@v1/ui/sidebar";
import { Building2 } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useOrganization } from "@/components/organization-provider";

export function DashboardHeader({ children }: { children: ReactNode }) {
  const { currentOrganization } = useOrganization();
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale as string;

  const getPageTitle = (path: string) => {
    const cleanPath = path.replace(`/${locale}`, "") || "/";

    if (cleanPath === "/" || cleanPath === "") return "Collections Overview";
    if (cleanPath === "/objects/new") return "New Object";
    if (/^\/objects\/[^/]+\/edit$/.test(cleanPath)) return "Edit Object";
    if (/^\/objects\/[^/]+$/.test(cleanPath)) return "Object Details";
    if (cleanPath.startsWith("/objects")) return "Object Catalog";
    if (cleanPath === "/exhibitions/new") return "New Exhibition";
    if (/^\/exhibitions\/[^/]+\/edit$/.test(cleanPath))
      return "Edit Exhibition";
    if (/^\/exhibitions\/[^/]+$/.test(cleanPath)) return "Exhibition Details";
    if (cleanPath.startsWith("/exhibitions")) return "Exhibition Management";

    const segment = cleanPath.split("/").pop();
    return segment
      ? segment.charAt(0).toUpperCase() + segment.slice(1)
      : "Overview";
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground flex items-center gap-2">
            <Building2 className="size-3.5" />
            {currentOrganization?.name ?? "MuseumLite"}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-medium text-foreground">
            {getPageTitle(pathname)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
