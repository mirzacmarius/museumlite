"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
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

// Animate UI's Base UI popover motion (https://animate-ui.com/docs/primitives/base-ui/popover):
// the popup grows from 0.8 and fades in from its trigger on a spring, and plays
// the same motion in reverse before it unmounts. Under reduced motion,
// MotionConfig keeps only the fade.
const POPOVER_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 29,
};
const HIDDEN = { opacity: 0, scale: 0.8 };
const SHOWN = { opacity: 1, scale: 1 };

const PopoverOpenContext = React.createContext(false);

// The newest open popover takes Escape. Radix dialogs, sheets and menus listen
// for Escape on the document and would close themselves first, so the popover
// claims the key on the window, which hears it before the document does.
const escapeStack: Array<() => void> = [];

function useEscapeCloses(open: boolean, close: () => void) {
  const closeRef = React.useRef(close);
  closeRef.current = close;
  React.useEffect(() => {
    if (!open) return;
    const entry = () => closeRef.current();
    escapeStack.push(entry);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || escapeStack.at(-1) !== entry) return;
      event.stopPropagation();
      event.preventDefault();
      entry();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      escapeStack.splice(escapeStack.indexOf(entry), 1);
    };
  }, [open]);
}

function Popover({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: Omit<PopoverPrimitive.Root.Props, "actionsRef">) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const actionsRef = React.useRef<PopoverPrimitive.Root.Actions>(null);
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean, details: PopoverPrimitive.Root.ChangeEventDetails) => {
      onOpenChange?.(nextOpen, details);
      if (!details.isCanceled) setUncontrolledOpen(nextOpen);
    },
    [onOpenChange],
  );
  useEscapeCloses(open, () => actionsRef.current?.close());
  return (
    <PopoverOpenContext.Provider value={open}>
      <PopoverPrimitive.Root
        data-slot="popover"
        open={open}
        onOpenChange={handleOpenChange}
        actionsRef={actionsRef}
        {...props}
      />
    </PopoverOpenContext.Provider>
  );
}

/**
 * `asChild` renders the trigger as its only child, as with Radix. A child
 * that is not a `<button>` element needs `nativeButton={false}`; plain DOM
 * children get it automatically.
 */
function PopoverTrigger({
  asChild = false,
  children,
  nativeButton,
  ...props
}: PopoverPrimitive.Trigger.Props & { asChild?: boolean }) {
  const child =
    asChild && React.isValidElement(children) ? children : undefined;
  const isNativeButton =
    nativeButton ??
    (typeof child?.type === "string" ? child.type === "button" : true);
  // A component child that is not a button, such as a menu item, keeps the
  // role and tab order it gives itself instead of Base UI's role="button".
  const render =
    child && !isNativeButton && typeof child.type !== "string"
      ? ({
          role: _role,
          tabIndex: _tabIndex,
          ...triggerProps
        }: object & {
          role?: string;
          tabIndex?: number;
        }) =>
          React.cloneElement(
            child,
            mergeProps(triggerProps, child.props as object),
          )
      : child;
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      nativeButton={isNativeButton}
      render={render}
      {...props}
    >
      {child ? undefined : children}
    </PopoverPrimitive.Trigger>
  );
}

type PopoverPositionerProps = Pick<
  PopoverPrimitive.Positioner.Props,
  "align" | "alignOffset" | "collisionPadding" | "side" | "sideOffset"
>;

function PopoverContent({
  className,
  align = "center",
  alignOffset,
  collisionPadding,
  side,
  sideOffset = 4,
  style,
  initialFocus,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "className" | "render" | "style"> &
  PopoverPositionerProps & {
    className?: string;
    style?: React.CSSProperties;
  }) {
  const open = React.useContext(PopoverOpenContext);
  const dialogContent = useDialogContentElement();
  const popupRef = React.useRef<HTMLDivElement>(null);
  // Like Radix, content that focuses itself on mount (a calendar's chosen
  // day) keeps that focus instead of losing it to the popup.
  const keepInnerFocus = React.useCallback(
    () => !popupRef.current?.contains(document.activeElement),
    [],
  );
  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Portal
            container={dialogContent ?? undefined}
            keepMounted
          >
            <PopoverPrimitive.Positioner
              className="z-50"
              align={align}
              alignOffset={alignOffset}
              collisionPadding={collisionPadding}
              side={side}
              sideOffset={sideOffset}
            >
              <PopoverPrimitive.Popup
                ref={popupRef}
                data-slot="popover-content"
                initialFocus={initialFocus ?? keepInnerFocus}
                className={cn(
                  "flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
                  className,
                )}
                style={{ transformOrigin: "var(--transform-origin)", ...style }}
                render={
                  <m.div
                    initial={HIDDEN}
                    animate={SHOWN}
                    exit={HIDDEN}
                    transition={POPOVER_TRANSITION}
                  />
                }
                {...props}
              />
            </PopoverPrimitive.Positioner>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
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
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
