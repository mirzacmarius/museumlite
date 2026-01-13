"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@v1/ui/utils";

/**
 * PageHeader - Standardized page header component
 *
 * Usage Guidelines:
 * - title: Page name (e.g., "Objects", "Loans", "Accessions")
 * - description: Brief context about the page (optional)
 * - breadcrumbs: Navigation path to current page (optional)
 * - actions: Primary action buttons (e.g., "Add Object", "New Loan")
 *
 * Patterns:
 * - List pages: Title + Description + Primary action
 * - Detail pages: Breadcrumbs + Title + Edit/Delete actions
 * - New/Edit pages: Breadcrumbs + Title (no actions)
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** Page title - required */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Optional breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional action buttons (right side) */
  actions?: React.ReactNode;
  /** Optional content below title/description */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b border-border bg-card", className)}>
      <div className="px-6 py-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                {index > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-medium text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * PageHeaderSkeleton - Loading state for PageHeader
 */
export function PageHeaderSkeleton({
  showBreadcrumbs = false,
  showDescription = true,
  showActions = true,
}: {
  showBreadcrumbs?: boolean;
  showDescription?: boolean;
  showActions?: boolean;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="px-6 py-4">
        {showBreadcrumbs && (
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-7 w-48 animate-pulse rounded bg-muted" />
            {showDescription && (
              <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
            )}
          </div>

          {showActions && (
            <div className="h-9 w-28 animate-pulse rounded bg-muted" />
          )}
        </div>
      </div>
    </div>
  );
}
