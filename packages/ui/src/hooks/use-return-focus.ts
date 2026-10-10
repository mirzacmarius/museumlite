import { type RefObject, useRef } from "react";

export interface ReturnFocusOptions {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** Receives focus on close when the control that opened the overlay is gone. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Radix modals return focus only to their own Trigger, so an overlay opened
 * from any other control (a selection bar, a form's Cancel) left focus on the
 * page body when it closed. This remembers what was focused when the overlay
 * opened and returns focus there, or to the fallback once that control is gone.
 * A consumer's `onCloseAutoFocus` that prevents the default still decides.
 */
export function useReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
  fallbackFocusRef,
}: ReturnFocusOptions) {
  const openerRef = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement;
      openerRef.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const opener = openerRef.current;
      openerRef.current = null;
      if (event.defaultPrevented) return;
      const target = opener?.isConnected ? opener : fallbackFocusRef?.current;
      if (!target) return;
      event.preventDefault();
      target.focus();
    },
  };
}
