"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import * as React from "react";
import { cn } from "../utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-64 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </HoverCardPrimitive.Portal>
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

interface EntityPreviewProps {
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  metadata?: Array<{ label: string; value: string }>;
  className?: string;
}

function EntityPreview({
  title,
  subtitle,
  description,
  image,
  metadata,
  className,
}: EntityPreviewProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {image && (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
          <img src={image} alt={title} className="size-full object-cover" />
        </div>
      )}

      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}

      {metadata && metadata.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          {metadata.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="flex justify-between text-xs"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent, EntityPreview };
