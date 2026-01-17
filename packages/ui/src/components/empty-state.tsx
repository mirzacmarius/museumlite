import type { LucideIcon } from "lucide-react";
import { cn } from "../utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4",
        className,
      )}
    >
      {Icon && <Icon className="h-12 w-12 text-muted-foreground/60 mb-4" />}
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground/60 mt-2 text-center max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-xs transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

EmptyState.displayName = "EmptyState";
