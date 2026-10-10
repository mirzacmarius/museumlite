import { type RefObject, useLayoutEffect } from "react";

/**
 * When `containerRef` leaves the page while focus is inside it (a bar that
 * closes after its last action), moves focus to `targetRef` instead of
 * letting it fall to the page body. Runs before the container is removed,
 * while its focused element is still there.
 */
export function useFocusOnLeave(
  containerRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null> | undefined,
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container?.contains(document.activeElement))
        targetRef?.current?.focus();
    };
  }, [containerRef, targetRef]);
}
