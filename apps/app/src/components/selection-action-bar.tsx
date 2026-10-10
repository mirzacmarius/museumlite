"use client";

import { Button } from "@v1/ui/button";
import { X } from "lucide-react";
import { useFocusOnLeave } from "@v1/ui/hooks";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";

interface SelectionActionBarProps {
  /** Names the bar, e.g. "Selected loans". */
  label: string;
  count: number;
  /** The selection in words, e.g. "3 loans selected". */
  countLabel: string;
  clearLabel: string;
  onClear: () => void;
  /** Takes focus when the bar closes while focus is in it, e.g. the list. */
  returnFocusRef: RefObject<HTMLElement | null>;
  /** The actions for the selected records. */
  children: ReactNode;
}

/**
 * Actions for the records selected in a list. The selection is announced as
 * it changes, and focus is not lost when the bar closes after an action.
 */
export function SelectionActionBar({
  count,
  countLabel,
  ...panel
}: SelectionActionBarProps) {
  return (
    <>
      <p role="status" className="sr-only">
        {count > 0 ? countLabel : ""}
      </p>
      {count > 0 ? (
        <SelectionActionPanel countLabel={countLabel} {...panel} />
      ) : null}
    </>
  );
}

/** The nearest ancestor that scrolls vertically, else the page. */
function scrollParent(element: HTMLElement) {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    )
      return parent;
  }
  return document.scrollingElement;
}

function SelectionActionPanel({
  label,
  countLabel,
  clearLabel,
  onClear,
  returnFocusRef,
  children,
}: Omit<SelectionActionBarProps, "count">) {
  const panelRef = useRef<HTMLElement>(null);
  useFocusOnLeave(panelRef, returnFocusRef);
  // The bar floats over the list; a row that takes focus under it is
  // scrolled up into sight, once the browser's own focus scrolling is done.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const revealFocused = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || panel.contains(target)) return;
      requestAnimationFrame(() => {
        const bar = panel.getBoundingClientRect();
        const focused = target.getBoundingClientRect();
        const covered = focused.bottom - bar.top + 16;
        const overlapsAcross =
          focused.right > bar.left && focused.left < bar.right;
        if (covered > 0 && focused.top < bar.bottom && overlapsAcross)
          scrollParent(target)?.scrollBy({ top: covered });
      });
    };
    document.addEventListener("focusin", revealFocused);
    return () => document.removeEventListener("focusin", revealFocused);
  }, []);

  return (
    <>
      {/* Room to scroll the last rows above the bar. */}
      <div aria-hidden="true" className="h-20" />
      <section
        ref={panelRef}
        aria-label={label}
        className="fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2"
      >
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 border-r border-border pr-3">
            <span className="text-sm font-medium">{countLabel}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={clearLabel}
              onClick={onClear}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {children}
          </div>
        </div>
      </section>
    </>
  );
}
