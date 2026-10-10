"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, MINUTE / 2);
  return () => clearInterval(timer);
}

function currentMinute() {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

/**
 * The current time rounded down to the minute, updated as minutes pass, for
 * queries that judge freshness at a time the caller passes. Null until the
 * page runs in the browser.
 */
export function useCurrentMinute(): number | null {
  return useSyncExternalStore(subscribe, currentMinute, () => null);
}
