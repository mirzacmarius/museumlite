"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  type Transition,
} from "framer-motion";
import * as React from "react";
import { cn } from "../utils";
import { useDialogContentElement } from "./dialog";

// Animate UI's Radix popover motion: content grows from 0.8 and fades in from
// its trigger on a spring, and plays the same motion in reverse before it
// unmounts. Under reduced motion, MotionConfig keeps only the fade.
const POPOVER_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 29,
};

const PopoverOpenContext = React.createContext(false);

function Popover({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );
  return (
    <PopoverOpenContext.Provider value={open}>
      <PopoverPrimitive.Root
        data-slot="popover"
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </PopoverOpenContext.Provider>
  );
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof PopoverPrimitive.Content>,
  "asChild" | "forceMount"
>) {
  const open = React.useContext(PopoverOpenContext);
  const dialogContent = useDialogContentElement();
  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Portal container={dialogContent} forceMount>
            <PopoverPrimitive.Content
              asChild
              forceMount
              align={align}
              sideOffset={sideOffset}
              {...props}
            >
              <m.div
                data-slot="popover-content"
                className={cn(
                  "z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
                  className,
                )}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={POPOVER_TRANSITION}
              >
                {children}
              </m.div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
