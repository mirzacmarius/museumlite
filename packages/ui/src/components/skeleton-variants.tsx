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
