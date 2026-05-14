"use client";

import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "list" | "grid";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  const tCommon = useScopedI18n("common");
  return (
    <div
      className={cn("inline-flex rounded-md border border-border", className)}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-r-none border-r border-border px-3",
          value === "list" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onChange("list")}
        aria-label={tCommon("listView")}
      >
        <List className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-l-none px-3",
          value === "grid" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onChange("grid")}
        aria-label={tCommon("gridView")}
      >
        <LayoutGrid className="size-4" />
      </Button>
    </div>
  );
}
