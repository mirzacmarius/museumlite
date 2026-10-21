"use client";

import { LazyMotion, m } from "framer-motion";
import * as React from "react";
import { cn } from "../utils";
import { SPRING } from "./motion";

const loadLayoutFeatures = () =>
  import("./motion-layout-features").then((mod) => mod.domMax);

const HighlightScopeContext = React.createContext<string | undefined>(
  undefined,
);

/**
 * One sliding highlight, Animate UI style: of the `Highlight`s rendered
 * inside, the newest springs over from where the previous one was.
 */
function HighlightScope({ children }: { children: React.ReactNode }) {
  const layoutId = React.useId();
  return (
    <HighlightScopeContext value={layoutId}>
      <LazyMotion features={loadLayoutFeatures} strict>
        {children}
      </LazyMotion>
    </HighlightScopeContext>
  );
}

/**
 * Fills its positioned parent behind the parent's content. An `isolate`
 * ancestor keeps it above that ancestor's background.
 */
function Highlight({ className }: { className?: string }) {
  const layoutId = React.useContext(HighlightScopeContext);
  return (
    <m.span
      aria-hidden
      data-slot="highlight"
      layoutId={layoutId}
      transition={SPRING}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 rounded-[inherit]",
        className,
      )}
    />
  );
}

/**
 * Whether a Radix menu or select item is highlighted. Radix highlights the
 * item that has focus, so this mirrors its `data-highlighted`.
 */
function useFocusHighlight<E extends Element>({
  onFocus,
  onBlur,
}: {
  onFocus?: React.FocusEventHandler<E>;
  onBlur?: React.FocusEventHandler<E>;
}) {
  const [highlighted, setHighlighted] = React.useState(false);
  return {
    highlighted,
    onFocus: (event: React.FocusEvent<E>) => {
      onFocus?.(event);
      setHighlighted(true);
    },
    onBlur: (event: React.FocusEvent<E>) => {
      onBlur?.(event);
      setHighlighted(false);
    },
  };
}

export { Highlight, HighlightScope, useFocusHighlight };
