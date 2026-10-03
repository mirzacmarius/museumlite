"use client";

import { Button } from "@v1/ui/button";
import { ScrollArea } from "@v1/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@v1/ui/sheet";
import { cn } from "@v1/ui/utils";
import { ChevronRight, X } from "lucide-react";
import * as React from "react";
import { useI18n } from "@/locales/client";

interface InspectorPanelContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const InspectorPanelContext =
  React.createContext<InspectorPanelContextValue | null>(null);

export function useInspectorPanel() {
  const context = React.use(InspectorPanelContext);
  if (!context) {
    throw new Error(
      "useInspectorPanel must be used within an InspectorPanelProvider",
    );
  }
  return context;
}

interface InspectorPanelProviderProps {
  children: React.ReactNode;
}

export function InspectorPanelProvider({
  children,
}: InspectorPanelProviderProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const value = React.useMemo(
    () => ({
      isOpen,
      setIsOpen,
      selectedId,
      setSelectedId: (id: string | null) => {
        setSelectedId(id);
        if (id) {
          setIsOpen(true);
        }
      },
    }),
    [isOpen, selectedId],
  );

  return (
    <InspectorPanelContext.Provider value={value}>
      {children}
    </InspectorPanelContext.Provider>
  );
}

interface InspectorPanelProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  onClose?: () => void;
}

const widthClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
};

export function InspectorPanel({
  title,
  subtitle,
  children,
  footer,
  width = "md",
  onClose,
}: InspectorPanelProps) {
  const translate = useI18n();
  const { isOpen, setIsOpen, setSelectedId } = useInspectorPanel();

  const handleClose = () => {
    setIsOpen(false);
    setSelectedId(null);
    onClose?.();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className={cn(
          "flex flex-col p-0 w-full",
          widthClasses[width],
          "border-l border-white/10",
        )}
      >
        <SheetHeader className="px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {title && (
                <SheetTitle className="text-base font-medium truncate">
                  {title}
                </SheetTitle>
              )}
              {subtitle && (
                <SheetDescription className="text-sm text-white/60 truncate mt-0.5">
                  {subtitle}
                </SheetDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 -mr-2"
              onClick={handleClose}
            >
              <X className="size-4" />
              <span className="sr-only">
                {translate("untranslatedComponents.labels.close")}
              </span>
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4">{children}</div>
        </ScrollArea>

        {footer && (
          <div className="px-6 py-4 border-t border-white/10 shrink-0 bg-background">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface InspectorSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function InspectorSection({
  title,
  children,
  className,
  collapsible = false,
  defaultExpanded = true,
}: InspectorSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(() => defaultExpanded);

  if (!collapsible) {
    return (
      <div className={cn("space-y-3", className)}>
        {title && (
          <h3 className="text-sm font-medium text-white/80">{title}</h3>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors w-full"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          {title}
        </button>
      )}
      {isExpanded && children}
    </div>
  );
}

interface InspectorFieldProps {
  label: string;
  value?: React.ReactNode;
  className?: string;
}

export function InspectorField({
  label,
  value,
  className,
}: InspectorFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-sm text-white/90">
        {value ?? <span className="text-white/30">-</span>}
      </span>
    </div>
  );
}

interface InspectorGridProps {
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function InspectorGrid({
  children,
  columns = 2,
  className,
}: InspectorGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 1 ? "grid-cols-1" : "grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface InspectorActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function InspectorActions({
  children,
  className,
}: InspectorActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>{children}</div>
  );
}

interface InspectorDividerProps {
  className?: string;
}

export function InspectorDivider({ className }: InspectorDividerProps) {
  return <div className={cn("border-t border-white/10 my-4", className)} />;
}
