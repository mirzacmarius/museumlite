"use client";

import { Button } from "@v1/ui/button";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@v1/ui/utils";

export type ViewMode = "list" | "grid";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
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
        aria-label="List view"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-l-none px-3",
          value === "grid" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onChange("grid")}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
