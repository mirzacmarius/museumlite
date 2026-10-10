"use client";

import { cn } from "@v1/ui/utils";
import { useEffect, useRef } from "react";

/** Why an action did not happen, in words staff can act on. */
export interface Refusal {
  message: string;
}

/**
 * Explains a refused action where staff acted, not in a toast or behind a
 * dialog. Each new refusal takes focus, which also scrolls it into view on a
 * small screen where the top of a form or dialog is out of sight. Pass a new
 * object for each failure so a repeated refusal is announced again.
 */
export function ActionRefusal({
  refusal,
  id,
  className,
}: {
  refusal: Refusal | null;
  id?: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (refusal) ref.current?.focus();
  }, [refusal]);
  if (!refusal) return null;
  return (
    <p
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className={cn(
        "rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {refusal.message}
    </p>
  );
}
