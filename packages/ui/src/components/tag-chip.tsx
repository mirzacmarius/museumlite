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

interface TagListProps extends React.HTMLAttributes<HTMLDivElement> {
  tags: string[];
  /** Maximum number of tags to display before showing "+N more" */
  maxVisible?: number;
}

function TagList({ className, tags, maxVisible, ...props }: TagListProps) {
  const visibleTags = maxVisible ? tags.slice(0, maxVisible) : tags;
  const hiddenCount = maxVisible ? Math.max(0, tags.length - maxVisible) : 0;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      {visibleTags.map((tag) => (
        <TagChip key={tag}>{tag}</TagChip>
      ))}
      {hiddenCount > 0 && (
        <span className="text-[10px] text-zinc-500">+{hiddenCount} more</span>
      )}
    </div>
  );
}

export type { TagChipProps, TagListProps };
export { TagChip, TagList };
