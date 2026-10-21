"use client";

import { Button } from "@v1/ui/button";
import { Highlight, HighlightScope } from "@v1/ui/motion-highlight";
import { cn } from "@v1/ui/utils";
import { Calendar, LayoutGrid } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

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
  const t = useScopedI18n("exhibitions");

  return (
    <HighlightScope>
      <div
        className={cn(
          "isolate inline-flex rounded-md border border-border",
          className,
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative rounded-r-none border-r border-border px-3",
            value === "gallery" && "text-accent-foreground",
          )}
          onClick={() => onChange("gallery")}
          aria-label={t("viewMode.gallery")}
        >
          {value === "gallery" && <Highlight className="bg-accent" />}
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative rounded-l-none px-3",
            value === "timeline" && "text-accent-foreground",
          )}
          onClick={() => onChange("timeline")}
          aria-label={t("viewMode.timeline")}
        >
          {value === "timeline" && <Highlight className="bg-accent" />}
          <Calendar className="size-4" />
        </Button>
      </div>
    </HighlightScope>
  );
}
