"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

export function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
