"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { Calendar, LayoutGrid } from "lucide-react";

export type ExhibitionViewMode = "gallery" | "timeline";

interface ViewToggleProps {
  value: ExhibitionViewMode;
  onChange: (mode: ExhibitionViewMode) => void;
  className?: string;
}

export function ExhibitionViewToggle({
  value,
  onChange,
  className,
}: ViewToggleProps) {
  return (
    <div
      className={cn("inline-flex rounded-md border border-border", className)}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-r-none border-r border-border px-3",
          value === "gallery" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onChange("gallery")}
        aria-label="Gallery view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-l-none px-3",
          value === "timeline" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onChange("timeline")}
        aria-label="Timeline view"
      >
        <Calendar className="h-4 w-4" />
      </Button>
    </div>
  );
}
