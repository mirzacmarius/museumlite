import { Building2, LayoutGrid, List } from "lucide-react";
import { cn } from "@v1/ui/utils";
import { SidebarTrigger } from "@v1/ui/sidebar";
import type { ReactNode } from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  viewMode?: "list" | "grid";
  onViewModeChange?: (view: "list" | "grid") => void;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumbs = [],
  breadcrumb,
  actions,
  viewMode,
  onViewModeChange,
  className,
}: PageHeaderProps) {
  const displayBreadcrumbs = [...breadcrumbs];

  if (displayBreadcrumbs.length === 0) {
    if (breadcrumb) {
      if (typeof breadcrumb === "string") {
        displayBreadcrumbs.push({
          label: breadcrumb,
          icon: <Building2 className="h-3.5 w-3.5" />,
        });
      }
    } else {
      displayBreadcrumbs.push({
        label: "National Museum",
        icon: <Building2 className="h-3.5 w-3.5" />,
      });
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 items-center justify-between border-b border-zinc-800/60 bg-zinc-950/80 px-6 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-center gap-4 text-xs">
        <SidebarTrigger className="-ml-2 mr-2 text-zinc-500 hover:text-zinc-300" />
        <div className="flex items-center gap-2">
          {displayBreadcrumbs.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-zinc-700">/</span>}

              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <span className="flex items-center gap-2 text-zinc-500">
                  {item.icon}
                  {item.label}
                </span>
              )}
            </div>
          ))}

          {displayBreadcrumbs.length === 0 &&
            breadcrumb &&
            typeof breadcrumb !== "string" && (
              <span className="flex items-center gap-2 text-zinc-500">
                <Building2 className="h-3.5 w-3.5" />
                {breadcrumb}
              </span>
            )}

          <span className="text-zinc-700">/</span>
          <span className="font-medium text-zinc-300">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onViewModeChange && viewMode && (
          <>
            <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                className={cn(
                  "rounded p-1.5 transition-colors",
                  viewMode === "list"
                    ? "border border-zinc-700 bg-zinc-800 text-zinc-200 shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                )}
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={cn(
                  "rounded p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "border border-zinc-700 bg-zinc-800 text-zinc-200 shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            {actions && <div className="h-4 w-px bg-zinc-800" />}
          </>
        )}

        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
