/**
 * The URL contract shared by operational lists: search text, named filters,
 * a sort and the loaded depth. Defaults stay out of the URL so shared links
 * are short, and unknown values fall back to defaults instead of failing.
 */

/** Allowed values with the default first, or "text" for any value. */
type FilterSpecValue = readonly [string, ...string[]] | "text";
type FilterSpec = Record<string, FilterSpecValue>;

export type FilterValues<Filters extends FilterSpec> = {
  [Key in keyof Filters]: Filters[Key] extends readonly string[]
    ? Filters[Key][number]
    : string;
};

export interface ListState<Filters extends FilterSpec, Sort extends string> {
  search: string;
  sort: Sort;
  /** Rows requested so far; reloading asks for the same depth. */
  show: number;
  filters: FilterValues<Filters>;
}

export interface ListStateChange<
  Filters extends FilterSpec,
  Sort extends string,
> {
  search?: string;
  sort?: Sort;
  filters?: Partial<FilterValues<Filters>>;
}

interface SearchParamsReader {
  get(name: string): string | null;
}

export interface ListStateDefinition<
  Filters extends FilterSpec,
  Sort extends string,
> {
  /** URL keys this list owns. */
  keys: string[];
  parse(params: SearchParamsReader): ListState<Filters, Sort>;
  href(path: string, state: ListState<Filters, Sort>): string;
  /** Values for a URL update; null removes a key that holds its default. */
  queryValues(state: ListState<Filters, Sort>): Record<string, string | null>;
  update(
    state: ListState<Filters, Sort>,
    change: ListStateChange<Filters, Sort>,
  ): ListState<Filters, Sort>;
  loadMore(state: ListState<Filters, Sort>): ListState<Filters, Sort>;
  clear(state: ListState<Filters, Sort>): ListState<Filters, Sort>;
  isFiltered(state: ListState<Filters, Sort>): boolean;
}

function pick<Value extends string>(
  allowed: readonly Value[],
  value: string | null,
): Value | undefined {
  return allowed.find((candidate) => candidate === value);
}

export function defineListState<
  const Filters extends FilterSpec,
  const Sorts extends readonly [string, ...string[]],
>(config: {
  filters: Filters;
  sorts: Sorts;
  /** Rows in the first page. */
  pageSize: number;
  /** Rows each "load more" adds; the first page size by default. */
  loadMoreSize?: number;
  maxDepth: number;
  /** False when another hook already owns the `search` key. */
  search?: boolean;
}): ListStateDefinition<Filters, Sorts[number]> {
  type Sort = Sorts[number];
  type State = ListState<Filters, Sort>;
  const ownsSearch = config.search ?? true;
  const filterEntries = Object.entries(config.filters).map(
    ([key, spec]) => [key, spec, spec === "text" ? "" : spec[0]] as const,
  );
  const defaultSort: Sort = config.sorts[0];

  function filtersFrom(read: (key: string, spec: FilterSpecValue) => string) {
    // Object.fromEntries cannot keep the per-key literal types.
    return Object.fromEntries(
      filterEntries.map(([key, spec]) => [key, read(key, spec)]),
    ) as FilterValues<Filters>;
  }

  const defaultFilters = filtersFrom((_key, spec) =>
    spec === "text" ? "" : spec[0],
  );

  function filterValue(state: State, key: string): string | undefined {
    return Object.entries(state.filters).find(([name]) => name === key)?.[1];
  }

  function clampDepth(depth: number) {
    return Math.min(Math.max(depth, config.pageSize), config.maxDepth);
  }

  function queryValues(state: State) {
    const values: Record<string, string | null> = {};
    if (ownsSearch) values.search = state.search || null;
    for (const [key, , fallback] of filterEntries) {
      const value = filterValue(state, key);
      values[key] = value === undefined || value === fallback ? null : value;
    }
    values.sort = state.sort === defaultSort ? null : state.sort;
    values.show = state.show === config.pageSize ? null : String(state.show);
    return values;
  }

  return {
    keys: [
      ...(ownsSearch ? ["search"] : []),
      ...filterEntries.map(([key]) => key),
      "sort",
      "show",
    ],
    parse(params) {
      const depth = Number.parseInt(params.get("show") ?? "", 10);
      return {
        search: ownsSearch ? (params.get("search") ?? "") : "",
        sort: pick(config.sorts, params.get("sort")) ?? defaultSort,
        show: Number.isFinite(depth) ? clampDepth(depth) : config.pageSize,
        filters: filtersFrom((key, spec) =>
          spec === "text"
            ? (params.get(key) ?? "")
            : (pick(spec, params.get(key)) ?? spec[0]),
        ),
      };
    },
    href(path, state) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(queryValues(state))) {
        if (value !== null) query.set(key, value);
      }
      const search = query.toString();
      return search ? `${path}?${search}` : path;
    },
    queryValues,
    update(state, change) {
      return {
        search: change.search ?? state.search,
        sort: change.sort ?? state.sort,
        show: config.pageSize,
        filters: { ...state.filters, ...change.filters },
      };
    },
    loadMore(state) {
      return {
        ...state,
        show: clampDepth(state.show + (config.loadMoreSize ?? config.pageSize)),
      };
    },
    clear(state) {
      return {
        search: "",
        sort: state.sort,
        show: config.pageSize,
        filters: defaultFilters,
      };
    },
    isFiltered(state) {
      return (
        state.search.trim() !== "" ||
        filterEntries.some(
          ([key, , fallback]) => filterValue(state, key) !== fallback,
        )
      );
    },
  };
}
