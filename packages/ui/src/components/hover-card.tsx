"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import Image from "next/image";
import type * as React from "react";
import { cn } from "../utils";
import { FLOATING_MOTION } from "./motion";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = ({
  className,
  align = "center",
  sideOffset = 4,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content> &
  React.RefAttributes<React.ElementRef<typeof HoverCardPrimitive.Content>>) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none",
        FLOATING_MOTION,
        className,
      )}
      {...props}
    />
  </HoverCardPrimitive.Portal>
);
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
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
          <Image
            src={image}
            alt={title}
            fill
            sizes="256px"
            className="object-cover"
            unoptimized={image.startsWith("blob:") || image.startsWith("data:")}
          />
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

export { EntityPreview, HoverCard, HoverCardContent, HoverCardTrigger };
