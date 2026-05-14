"use client";

import type { AutoSaveStatus } from "@/hooks/use-auto-save";
import { cn } from "@v1/ui/utils";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  isDirty: boolean;
  error?: string | null;
  className?: string;
  showLastSaved?: boolean;
}

export function AutoSaveIndicator({
  status,
  lastSaved,
  isDirty,
  error,
  className,
  showLastSaved = true,
}: AutoSaveIndicatorProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case "saving":
        return {
          icon: <Loader2 className="size-3.5 animate-spin" />,
          text: "Saving...",
          color: "text-white/60",
        };
      case "saved":
        return {
          icon: <Check className="size-3.5" />,
          text: "Saved",
          color: "text-emerald-400",
        };
      case "error":
        return {
          icon: <AlertCircle className="size-3.5" />,
          text: error || "Save failed",
          color: "text-red-400",
        };
      default:
        if (isDirty) {
          return {
            icon: <Cloud className="size-3.5" />,
            text: "Unsaved changes",
            color: "text-amber-400",
          };
        }
        return {
          icon: <Cloud className="size-3.5" />,
          text:
            lastSaved && showLastSaved
              ? `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`
              : "All changes saved",
          color: "text-white/40",
        };
    }
  };

  const { icon, text, color } = getStatusDisplay();

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors duration-200",
        color,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
