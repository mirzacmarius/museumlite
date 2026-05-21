"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useEffect, useState } from "react";

export function FooterSystemStatus() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Avoid SSR/client hydration mismatches by rendering nothing until mounted.
  if (!isMounted) return null;

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
