"use client";

import "@/lib/nuqs-localstorage-shim";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { recordViewState } from "@/lib/record-recovery";
import {
  backToResultsHref,
  listReturnPath,
  RETURN_PATH_PARAM,
} from "@/lib/return-path";

/**
 * The current list view, for detail links that should lead back to it.
 * `keys` are the URL keys that make up the view; pass a stable array.
 */
export function useListReturnPath(keys: readonly string[]) {
  const pathname = usePathname();
  const parsers = useMemo(
    () => Object.fromEntries(keys.map((key) => [key, parseAsString])),
    [keys],
  );
  const [values] = useQueryStates(parsers);
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = values[key];
    if (value) params.set(key, value);
  }
  return listReturnPath(pathname, params);
}

/** Where a detail page's back link goes; see `backToResultsHref`. */
export function useBackToResults(listHref: string) {
  const [returnPath] = useQueryState(RETURN_PATH_PARAM);
  return backToResultsHref(returnPath, listHref);
}

/**
 * Loading, ready, missing, or removed while open. A reactive record that
 * turns null after it was shown was removed, which needs different copy.
 */
export function useRecordViewState<Row>(record: Row | null | undefined) {
  const [wasShown, setWasShown] = useState(false);
  if (record && !wasShown) setWasShown(true);
  return recordViewState(record, wasShown || Boolean(record));
}
