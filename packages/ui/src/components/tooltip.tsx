"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@v1/ui/utils";
import type * as React from "react";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 4,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 origin-(--radix-tooltip-content-transform-origin) overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
          "animate-in fade-in-0 zoom-in-80 ease-spring duration-spring data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-80 data-[state=closed]:ease-in data-[state=closed]:duration-150",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
