"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { useReturnFocus } from "../hooks/use-return-focus";
import { useUiLocale } from "../locale";
import { cn } from "../utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> &
  React.RefAttributes<React.ElementRef<typeof DialogPrimitive.Overlay>>) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-zinc-950/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = ({
  className,
  children,
  closeLabel,
  onOpenAutoFocus,
  onCloseAutoFocus,
  fallbackFocusRef,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
  React.RefAttributes<React.ElementRef<typeof DialogPrimitive.Content>> & {
    closeLabel?: string;
    /** Receives focus on close when the control that opened it is gone. */
    fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  }) => {
  const { messages } = useUiLocale();
  const returnFocus = useReturnFocus({
    onOpenAutoFocus,
    onCloseAutoFocus,
    fallbackFocusRef,
  });

  return (
    <DialogPortal>
      <DialogOverlay />
      {/* The overlay scrolls, so a dialog taller than the screen stays reachable. */}
      <DialogPrimitive.Content
        ref={ref}
        className="fixed inset-0 z-50 overflow-y-auto duration-200 print:overflow-visible data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        {...props}
        {...returnFocus}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={cn(
              "relative grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg",
              className,
            )}
          >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="size-4" />
              <span className="sr-only">
                {closeLabel ?? messages.dialog.close}
              </span>
            </DialogPrimitive.Close>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> &
  React.RefAttributes<React.ElementRef<typeof DialogPrimitive.Title>>) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // Clear of the close button, so long translated titles wrap before it.
      "px-6 text-lg font-semibold leading-tight tracking-tight sm:px-0 sm:pe-6",
      className,
    )}
    {...props}
  />
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> &
  React.RefAttributes<
    React.ElementRef<typeof DialogPrimitive.Description>
  >) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
