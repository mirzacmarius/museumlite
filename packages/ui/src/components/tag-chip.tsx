import type * as React from "react";
import { cn } from "../utils";

interface TagChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

function TagChip({ className, children, ...props }: TagChipProps) {
  return (
    <span
      className={cn(
        "rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { TagChip };
export type { TagChipProps };
