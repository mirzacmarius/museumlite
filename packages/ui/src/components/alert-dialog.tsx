"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type * as React from "react";
import { useReturnFocus } from "../hooks/use-return-focus";
import { cn } from "../utils";
import { buttonVariants } from "./button";
import { DIALOG_MOTION, OVERLAY_MOTION } from "./motion";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> &
  React.RefAttributes<
    React.ElementRef<typeof AlertDialogPrimitive.Overlay>
  >) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-zinc-950/80",
      OVERLAY_MOTION,
      className,
    )}
    {...props}
    ref={ref}
  />
);
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = ({
  className,
  layerClassName,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> &
  React.RefAttributes<React.ElementRef<typeof AlertDialogPrimitive.Content>> & {
    /** Stacking of the overlay and dialog layer, e.g. above another overlay. */
    layerClassName?: string;
  }) => {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay className={layerClassName} />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-0 z-50 overflow-y-auto",
          DIALOG_MOTION,
          layerClassName,
        )}
        {...props}
        {...returnFocus}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={cn(
              "grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
};
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
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
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title> &
  React.RefAttributes<React.ElementRef<typeof AlertDialogPrimitive.Title>>) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
);
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description> &
  React.RefAttributes<
    React.ElementRef<typeof AlertDialogPrimitive.Description>
  >) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> &
  React.RefAttributes<
    React.ElementRef<typeof AlertDialogPrimitive.Action>
  >) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> &
  React.RefAttributes<
    React.ElementRef<typeof AlertDialogPrimitive.Cancel>
  >) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className,
    )}
    {...props}
  />
);
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
