"use client";

import { Button, type ButtonProps } from "@v1/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";

interface IconActionButtonProps
  extends Omit<ButtonProps, "size" | "asChild" | "aria-label"> {
  label: string;
}

export function IconActionButton({
  label,
  className,
  children,
  variant = "outline",
  ...props
}: IconActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          type={props.type ?? "button"}
          variant={variant}
          size="icon"
          aria-label={label}
          className={cn(
            "size-8 rounded-full border-border/60 bg-muted/40 text-muted-foreground shadow-sm transition-[color,background-color,border-color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10",
            className,
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={5}
        className="rounded-lg border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-lg dark:border-white/15"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}