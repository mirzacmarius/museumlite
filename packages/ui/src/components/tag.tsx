import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  onRemove?: () => void;
  removable?: boolean;
}

function Tag({
  className,
  children,
  onRemove,
  removable = false,
  ...props
}: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400",
        className,
      )}
      {...props}
    >
      {children}
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:text-zinc-200 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

export interface TagListProps extends React.HTMLAttributes<HTMLDivElement> {
  tags: string[];
  onRemove?: (tag: string) => void;
  removable?: boolean;
}

function TagList({
  className,
  tags,
  onRemove,
  removable = false,
  ...props
}: TagListProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} {...props}>
      {tags.map((tag) => (
        <Tag
          key={tag}
          removable={removable}
          onRemove={onRemove ? () => onRemove(tag) : undefined}
        >
          {tag}
        </Tag>
      ))}
    </div>
  );
}

export { Tag, TagList };
