"use client";

import "@/lib/nuqs-localstorage-shim";
import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FilterValues,
  ListState,
  ListStateChange,
  ListStateDefinition,
} from "@/lib/list-state";

type AnyFilterSpec = Record<string, readonly [string, ...string[]] | "text">;

/**
 * Binds a list's URL contract to the address bar. Updates replace the current
 * history entry, so Back returns to the page before the list with the list's
 * last view intact, and a reload or shared link shows the same view.
 */
export function useListState<
  Filters extends AnyFilterSpec,
  Sort extends string,
>(definition: ListStateDefinition<Filters, Sort>) {
  const parsers = useMemo(
    () =>
      Object.fromEntries(definition.keys.map((key) => [key, parseAsString])),
    [definition],
  );
  const [values, setValues] = useQueryStates(parsers, {
    history: "replace",
    scroll: false,
  });
  const state = useMemo(
    () => definition.parse({ get: (key) => values[key] ?? null }),
    [definition, values],
  );

  const apply = useCallback(
    (next: (current: ListState<Filters, Sort>) => ListState<Filters, Sort>) =>
      void setValues((current) =>
        definition.queryValues(
          next(definition.parse({ get: (key) => current[key] ?? null })),
        ),
      ),
    [definition, setValues],
  );

  return {
    state,
    isFiltered: definition.isFiltered(state),
    update: useCallback(
      (change: ListStateChange<Filters, Sort>) =>
        apply((current) => definition.update(current, change)),
      [apply, definition],
    ),
    setFilter: useCallback(
      <Key extends keyof Filters>(
        key: Key,
        value: FilterValues<Filters>[Key],
      ) =>
        apply((current) =>
          definition.update(current, {
            filters: { [key]: value } as Partial<FilterValues<Filters>>,
          }),
        ),
      [apply, definition],
    ),
    loadMore: useCallback(
      () => apply((current) => definition.loadMore(current)),
      [apply, definition],
    ),
    clear: useCallback(
      () => apply((current) => definition.clear(current)),
      [apply, definition],
    ),
  };
}

/**
 * A search box that types freely and commits to the URL after a pause, and
 * follows the URL when it changes elsewhere (Back, Clear filters).
 */
export function useDebouncedSearch(
  committed: string,
  commit: (value: string) => void,
  delayMs = 300,
) {
  const [input, setInput] = useState(committed);
  const [lastCommitted, setLastCommitted] = useState(committed);
  if (committed !== lastCommitted) {
    setLastCommitted(committed);
    setInput(committed);
  }

  useEffect(() => {
    if (input === committed) return;
    const timeoutId = window.setTimeout(() => commit(input), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [commit, committed, delayMs, input]);

  return [input, setInput] as const;
}
