"use client";

import { cn } from "@v1/ui/utils";
import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";
import type { AutoSaveStatus } from "@/hooks/use-auto-save";
import { formatDistanceLocale } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";

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
  const translate = useI18n();
  const locale = useCurrentLocale();
  const getStatusDisplay = () => {
    switch (status) {
      case "saving":
        return {
          icon: <Loader2 className="size-3.5 animate-spin" />,
          text: translate("untranslatedComponents.status.saving"),
          color: "text-white/60",
        };
      case "saved":
        return {
          icon: <Check className="size-3.5" />,
          text: translate("untranslatedComponents.status.saved"),
          color: "text-emerald-400",
        };
      case "error":
        return {
          icon: <AlertCircle className="size-3.5" />,
          text: error || translate("untranslatedComponents.status.saveFailed"),
          color: "text-red-400",
        };
      default:
        if (isDirty) {
          return {
            icon: <Cloud className="size-3.5" />,
            text: translate("untranslatedComponents.labels.unsavedChanges"),
            color: "text-amber-400",
          };
        }
        return {
          icon: <Cloud className="size-3.5" />,
          text:
            lastSaved && showLastSaved
              ? translate("untranslatedComponents.status.savedRelative", {
                  time: formatDistanceLocale(lastSaved, locale),
                })
              : translate("untranslatedComponents.status.allChangesSaved"),
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
