import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "../utils";

interface TimelineItem {
  title: string;
  description?: string;
  date: React.ReactNode;
  status?: "pending" | "active" | "completed" | "overdue";
  icon?: LucideIcon;
}

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
}

const Timeline = ({
  items,
  className,
  ref,
  ...props
}: TimelineProps & React.RefAttributes<HTMLDivElement>) => {
  return (
    <div ref={ref} className={cn("relative pl-4", className)} {...props}>
      <div className="absolute left-1.5 w-px bg-zinc-800 top-2 bottom-2" />

      <div className="space-y-6">
        {items.map((item, _index) => (
          <div
            key={`${item.title}-${item.status ?? "none"}-${item.description ?? ""}`}
            className="relative pl-4"
          >
            <div
              className={cn(
                "absolute -left-4 top-1 size-3 rounded-full border-2 border-zinc-950",
                {
                  "bg-amber-500 border-amber-400": item.status === "pending",
                  "bg-emerald-500 border-emerald-400": item.status === "active",
                  "bg-primary border-primary": item.status === "completed",
                  "bg-rose-500 border-rose-400": item.status === "overdue",
                  "bg-zinc-700 border-zinc-600": !item.status,
                },
              )}
            />

            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground/80">
                  {item.title}
                </span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                  {item.date}
                </span>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

Timeline.displayName = "Timeline";

export { Timeline, type TimelineItem, type TimelineProps };
