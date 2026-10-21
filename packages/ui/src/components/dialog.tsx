"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { useReturnFocus } from "../hooks/use-return-focus";
import { useUiLocale } from "../locale";
import { cn } from "../utils";
import { DIALOG_MOTION, OVERLAY_MOTION } from "./motion";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogContentElementContext = createContext<HTMLElement | null>(null);

/**
 * The open dialog's content element. A popover portals into it because the
 * dialog's scroll lock cancels wheel events from anywhere else.
 */
function useDialogContentElement() {
  return useContext(DialogContentElementContext);
}

const DialogOverlay = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> &
  React.RefAttributes<React.ElementRef<typeof DialogPrimitive.Overlay>>) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-zinc-950/80",
      OVERLAY_MOTION,
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
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(
    null,
  );
  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      setContentElement(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <DialogPortal>
      <DialogOverlay />
      {/* The overlay scrolls, so a dialog taller than the screen stays reachable. */}
      <DialogPrimitive.Content
        ref={contentRef}
        className={cn(
          "fixed inset-0 z-50 overflow-y-auto print:overflow-visible",
          DIALOG_MOTION,
        )}
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
            <DialogContentElementContext value={contentElement}>
              {children}
            </DialogContentElementContext>
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
  useDialogContentElement,
};
