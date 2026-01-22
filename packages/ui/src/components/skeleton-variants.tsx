import { cn } from "../utils";

interface SkeletonProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl h-32 bg-card/40 border border-border/60 animate-pulse",
        className,
      )}
    />
  );
}

export function SkeletonTable({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border border-border/60",
        className,
      )}
    >
      <div className="h-10 bg-card/40" />
      {[...Array(5)].map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton rows
          key={i}
          className="h-12 bg-card/20 border-t border-border/50 animate-pulse"
        />
      ))}
    </div>
  );
}

interface SkeletonTextProps extends SkeletonProps {
  width?: string | number;
}

export function SkeletonText({ className, width }: SkeletonTextProps) {
  return (
    <div
      className={cn("h-4 w-full bg-muted/50 rounded animate-pulse", className)}
      style={width ? { width } : undefined}
    />
  );
}

interface SkeletonAvatarProps extends SkeletonProps {
  size?: "sm" | "md" | "lg";
}

export function SkeletonAvatar({
  className,
  size = "md",
}: SkeletonAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn(
        "rounded-full bg-muted/50 animate-pulse",
        sizeClasses[size],
        className,
      )}
    />
  );
}

interface SkeletonListProps extends SkeletonProps {
  count?: number;
  variant?: "list" | "grid";
}

export function SkeletonList({
  className,
  count = 5,
  variant = "list",
}: SkeletonListProps) {
  if (variant === "grid") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
          className,
        )}
      >
        {[...Array(count)].map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items
            key={i}
            className="rounded-xl border border-border/60 overflow-hidden"
          >
            <div className="aspect-[4/3] bg-muted/40 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {[...Array(count)].map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-4"
        >
          <div className="h-12 w-12 rounded bg-muted/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted/30 rounded animate-pulse" />
          </div>
          <div className="h-8 w-8 rounded bg-muted/40 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonFormProps extends SkeletonProps {
  fields?: number;
}

export function SkeletonForm({ className, fields = 4 }: SkeletonFormProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {[...Array(fields)].map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton fields
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
          <div className="h-10 w-full bg-muted/30 rounded-lg border border-border/60 animate-pulse" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <div className="h-10 w-24 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

interface SkeletonStatsProps extends SkeletonProps {
  count?: number;
}

export function SkeletonStats({ className, count = 4 }: SkeletonStatsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
        className,
      )}
    >
      {[...Array(count)].map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton stats
          key={i}
          className="rounded-xl border border-border/60 bg-card p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="h-8 w-16 bg-muted/60 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonTimelineProps extends SkeletonProps {
  count?: number;
}

export function SkeletonTimeline({
  className,
  count = 5,
}: SkeletonTimelineProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {[...Array(count)].map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton timeline
          key={i}
          className="flex gap-4"
        >
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-muted/50 animate-pulse" />
            {i < count - 1 && (
              <div className="w-0.5 flex-1 bg-border/60 my-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="h-4 w-48 bg-muted/50 rounded animate-pulse mb-2" />
            <div className="h-3 w-64 bg-muted/30 rounded animate-pulse mb-1" />
            <div className="h-3 w-24 bg-muted/20 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
