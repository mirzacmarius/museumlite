"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { HelpCircle } from "lucide-react";
import type * as React from "react";
import { useI18n } from "@/locales/client";

interface InfoTooltipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function InfoTooltip({
  content,
  side = "right",
  className,
}: InfoTooltipProps) {
  const translate = useI18n();
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
              className,
            )}
          >
            <HelpCircle className="size-4" />
            <span className="sr-only">
              {translate("untranslatedComponents.labels.moreInformation")}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
