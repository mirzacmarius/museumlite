"use client";

import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className,
      )}
      {...props}
    >
      {/* Mounted while unchecked too, so the check animates on a change of state but not on page load. */}
      <CheckboxPrimitive.Indicator
        forceMount
        data-slot="checkbox-indicator"
        className="grid scale-50 place-content-center text-current opacity-0 transition-[scale,opacity] duration-spring ease-spring motion-reduce:scale-100 data-[state=checked]:scale-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:scale-100 data-[state=indeterminate]:opacity-100 [&>svg]:size-3.5 [&_path]:[stroke-dasharray:24] [&_path]:[stroke-dashoffset:24] [&_path]:transition-[stroke-dashoffset] [&_path]:duration-300 [&_path]:ease-out motion-reduce:[&_path]:[stroke-dashoffset:0] data-[state=checked]:[&_path]:[stroke-dashoffset:0] data-[state=indeterminate]:[&_path]:[stroke-dashoffset:0]"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
