import { cn } from "@v1/ui/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DetailSectionProps {
  title: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** A titled card that groups related fields on the object page. */
export function DetailSection({
  title,
  icon: Icon,
  actions,
  className,
  bodyClassName,
  children,
}: DetailSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? (
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          ) : null}
          {title}
        </h3>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card p-4 sm:p-6",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function DetailLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-xs font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface DetailFieldProps {
  label: ReactNode;
  value?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** A label above its value; an empty value shows a muted dash. */
export function DetailField({
  label,
  value,
  className,
  children,
}: DetailFieldProps) {
  const content = children ?? value;
  const isEmpty =
    content === undefined ||
    content === null ||
    content === "" ||
    content === false;
  return (
    <div className={cn("grid min-w-0 content-start gap-1", className)}>
      <DetailLabel>{label}</DetailLabel>
      {isEmpty ? (
        <div className="text-sm text-muted-foreground/70">-</div>
      ) : typeof content === "string" || typeof content === "number" ? (
        <div className="break-words text-sm text-foreground">{content}</div>
      ) : (
        content
      )}
    </div>
  );
}

export function DetailGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
