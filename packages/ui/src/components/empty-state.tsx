import type { LucideIcon } from "lucide-react";
import { ExternalLink, HelpCircle, Play } from "lucide-react";
import { cn } from "../utils";
import { Button } from "./button";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "ghost";
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  helpLink?: {
    label: string;
    href: string;
  };
  videoTutorial?: {
    label: string;
    href: string;
  };
  tips?: string[];
  variant?: "default" | "centered" | "card";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  helpLink,
  videoTutorial,
  tips,
  variant = "default",
  size = "md",
  className,
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-6 px-4",
    md: "py-12 px-4",
    lg: "py-16 px-6",
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const variantClasses = {
    default: "",
    centered: "text-center",
    card: "rounded-lg border border-border bg-card p-8",
  };

  const renderAction = (actionConfig: EmptyStateAction, isPrimary: boolean) => {
    const ActionIcon = actionConfig.icon;
    const buttonVariant =
      actionConfig.variant ?? (isPrimary ? "default" : "outline");

    if (actionConfig.href) {
      return (
        <Button
          asChild
          variant={buttonVariant}
          size={size === "sm" ? "sm" : "default"}
        >
          <a href={actionConfig.href}>
            {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
            {actionConfig.label}
          </a>
        </Button>
      );
    }

    return (
      <Button
        variant={buttonVariant}
        size={size === "sm" ? "sm" : "default"}
        onClick={actionConfig.onClick}
      >
        {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
        {actionConfig.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn("text-muted-foreground/60 mb-4", iconSizes[size])}
        />
      )}

      <h3
        className={cn(
          "font-medium text-foreground",
          size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            "text-muted-foreground mt-2 text-center max-w-md",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}

      {tips && tips.length > 0 && (
        <div className="mt-4 space-y-1">
          {tips.map((tip) => (
            <p
              key={tip}
              className="text-xs text-muted-foreground flex items-start gap-2"
            >
              <span className="text-primary">•</span>
              {tip}
            </p>
          ))}
        </div>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && renderAction(action, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}

      {(helpLink || videoTutorial) && (
        <div className="mt-4 flex items-center gap-4 text-xs">
          {helpLink && (
            <a
              href={helpLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-3 w-3" />
              {helpLink.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {videoTutorial && (
            <a
              href={videoTutorial.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Play className="h-3 w-3" />
              {videoTutorial.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

EmptyState.displayName = "EmptyState";
