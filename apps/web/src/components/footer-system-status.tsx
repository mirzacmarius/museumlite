"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useIsClient } from "@/hooks/use-is-client";

function FooterSystemStatusPlaceholder() {
  return (
    <div className="flex items-center gap-2">
      <div className="size-2 rounded-full bg-green-500/40" />
      <p className="text-xs text-muted-foreground">All systems normal</p>
    </div>
  );
}

function FooterSystemStatusContent() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <div className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-500" />
            </div>
            <p className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              All systems normal
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2 p-1">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">API</span>
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="size-1.5 rounded-full bg-current" />
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Database</span>
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="size-1.5 rounded-full bg-current" />
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Auth</span>
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="size-1.5 rounded-full bg-current" />
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Storage</span>
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="size-1.5 rounded-full bg-current" />
                Operational
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FooterSystemStatus() {
  const isClient = useIsClient();

  if (!isClient) {
    return <FooterSystemStatusPlaceholder />;
  }

  return <FooterSystemStatusContent />;
}
