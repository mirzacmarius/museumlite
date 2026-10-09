"use client";

import "@/lib/nuqs-localstorage-shim";
import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ListState,
  ListStateChange,
  ListStateDefinition,
} from "@/lib/list-state";

type AnyFilterSpec = Record<string, readonly [string, ...string[]] | "text">;

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Binds a list's URL contract to the address bar. Updates replace the current
 * history entry, so Back returns to the page before the list with the list's
 * last view intact, and a reload or shared link shows the same view.
 *
 * `searchInput` types freely and commits to the URL after a pause; it follows
 * the URL when the search changes elsewhere, and `clear` drops pending text.
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

  const [searchInput, setSearchInput] = useState(state.search);
  const [followedSearch, setFollowedSearch] = useState(state.search);
  if (state.search !== followedSearch) {
    setFollowedSearch(state.search);
    setSearchInput(state.search);
  }
  useEffect(() => {
    if (searchInput === state.search) return;
    const timeoutId = window.setTimeout(
      () =>
        apply((current) => definition.update(current, { search: searchInput })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [apply, definition, searchInput, state.search]);

  return {
    state,
    isFiltered: definition.isFiltered(state),
    searchInput,
    setSearchInput,
    update: useCallback(
      (change: ListStateChange<Filters, Sort>) =>
        apply((current) => definition.update(current, change)),
      [apply, definition],
    ),
    loadMore: useCallback(
      () => apply((current) => definition.loadMore(current)),
      [apply, definition],
    ),
    clear: useCallback(() => {
      setSearchInput("");
      apply((current) => definition.clear(current));
    }, [apply, definition]),
  };
}
