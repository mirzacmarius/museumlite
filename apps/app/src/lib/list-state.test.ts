import { describe, expect, test } from "vitest";
import { defineListState } from "./list-state";

const loans = defineListState({
  filters: {
    status: ["all", "pending", "active"],
    type: ["all", "incoming", "outgoing"],
  },
  sorts: ["newest", "oldest"],
  pageSize: 25,
  maxDepth: 200,
});

const params = (query: string) => new URLSearchParams(query);

describe("reading a list URL", () => {
  test("an empty URL is the list's default view", () => {
    expect(loans.parse(params(""))).toEqual({
      search: "",
      sort: "newest",
      show: 25,
      filters: { status: "all", type: "all" },
    });
  });

  test("search, filters, sort and loaded depth come from the URL", () => {
    expect(
      loans.parse(
        params("search=map&status=pending&type=incoming&sort=oldest&show=75"),
      ),
    ).toEqual({
      search: "map",
      sort: "oldest",
      show: 75,
      filters: { status: "pending", type: "incoming" },
    });
  });

  test("unknown values fall back to defaults and depth stays within bounds", () => {
    expect(
      loans.parse(params("status=archived&sort=title&show=abc")),
    ).toMatchObject({ sort: "newest", show: 25, filters: { status: "all" } });
    expect(loans.parse(params("show=5")).show).toBe(25);
    expect(loans.parse(params("show=100000")).show).toBe(200);
  });
});

describe("writing a list URL", () => {
  test("defaults are left out so shared links stay short", () => {
    expect(loans.href("/loans", loans.parse(params("")))).toBe("/loans");
  });

  test("a shared or reloaded link reproduces the same view", () => {
    const state = loans.parse(
      params("search=Fjord%20map&status=active&sort=oldest&show=50"),
    );
    const href = loans.href("/loans", state);

    expect(href).toBe(
      "/loans?search=Fjord+map&status=active&sort=oldest&show=50",
    );
    expect(loans.parse(new URL(href, "https://app.test").searchParams)).toEqual(
      state,
    );
  });
});

describe("free-text filters", () => {
  const exhibitions = defineListState({
    filters: { schedule: ["all", "current"], object: "text" },
    sorts: ["newest"],
    pageSize: 24,
    maxDepth: 24,
  });

  test("hold any value and default to empty", () => {
    expect(exhibitions.parse(params("object=abc123")).filters).toEqual({
      schedule: "all",
      object: "abc123",
    });
    expect(exhibitions.parse(params("")).filters.object).toBe("");
  });

  test("count as narrowing only when set", () => {
    expect(exhibitions.isFiltered(exhibitions.parse(params("")))).toBe(false);
    expect(
      exhibitions.isFiltered(exhibitions.parse(params("object=abc123"))),
    ).toBe(true);
  });

  test("a search owned elsewhere stays out of this list's URL keys", () => {
    const catalog = defineListState({
      filters: {},
      sorts: ["newest", "oldest"],
      pageSize: 20,
      maxDepth: 500,
      search: false,
    });

    expect(catalog.keys).toEqual(["sort", "show"]);
    expect(catalog.parse(params("search=map&sort=oldest")).search).toBe("");
  });
});

describe("changing the view", () => {
  const deep = loans.parse(params("status=pending&show=100"));

  test("a new search, filter or sort starts again from the first page", () => {
    expect(loans.update(deep, { search: "map" })).toEqual({
      ...deep,
      search: "map",
      show: 25,
    });
    expect(loans.update(deep, { filters: { type: "outgoing" } })).toEqual({
      ...deep,
      filters: { status: "pending", type: "outgoing" },
      show: 25,
    });
    expect(loans.update(deep, { sort: "oldest" }).show).toBe(25);
  });

  test("loading more deepens the list one page at a time up to its bound", () => {
    expect(loans.loadMore(deep).show).toBe(125);
    expect(loans.loadMore(loans.parse(params("show=190"))).show).toBe(200);
  });

  test("clearing keeps the sort but drops search and filters", () => {
    const filtered = loans.parse(
      params("search=map&status=active&sort=oldest"),
    );

    expect(loans.clear(filtered)).toEqual({
      search: "",
      sort: "oldest",
      show: 25,
      filters: { status: "all", type: "all" },
    });
  });

  test("loading more can use a larger step than the first page", () => {
    const catalog = defineListState({
      filters: {},
      sorts: ["newest"],
      pageSize: 20,
      loadMoreSize: 40,
      maxDepth: 500,
    });

    expect(catalog.loadMore(catalog.parse(params(""))).show).toBe(60);
  });

  test("only search and filters count as narrowing the list", () => {
    expect(loans.isFiltered(loans.parse(params("sort=oldest&show=50")))).toBe(
      false,
    );
    expect(loans.isFiltered(loans.parse(params("search=map")))).toBe(true);
    expect(loans.isFiltered(loans.parse(params("type=incoming")))).toBe(true);
  });
});
