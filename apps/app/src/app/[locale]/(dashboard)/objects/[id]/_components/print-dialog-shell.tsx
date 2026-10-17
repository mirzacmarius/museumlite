"use client";

import { Button } from "@v1/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { cn } from "@v1/ui/utils";
import { Info, Printer } from "lucide-react";
import type { ReactNode } from "react";

interface PrintDialogShellProps {
  title: string;
  description: string;
  cancelLabel: string;
  printLabel: string;
  onCancel: () => void;
  onPrint: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Shared frame for the object page's print dialogs: themed header and footer
 * around a scrolling body, all hidden when printing except the body.
 */
export function PrintDialogShell({
  title,
  description,
  cancelLabel,
  printLabel,
  onCancel,
  onPrint,
  className,
  children,
}: PrintDialogShellProps) {
  return (
    <DialogContent
      className={cn(
        "flex h-[90dvh] w-full flex-col gap-0 overflow-hidden p-0 print:h-auto print:max-h-none print:w-full print:max-w-none print:overflow-visible print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none",
        className,
      )}
    >
      <DialogHeader className="shrink-0 border-b py-4 pl-4 pr-12 text-left sm:pl-6 print:hidden">
        <DialogTitle className="px-0 sm:pe-0">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
        {children}
      </div>

      <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:space-x-0 sm:px-6 print:hidden">
        <Button variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={onPrint}>
          <Printer className="mr-2 size-4" />
          {printLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** The surface a preview sits on, like paper on a desk. */
export function PrintPreviewStage({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted/60 p-4 sm:p-8 print:bg-white print:p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PrintInstructions({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 p-3 print:hidden">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Info className="size-3.5 text-muted-foreground" aria-hidden />
        {title}
      </h3>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
