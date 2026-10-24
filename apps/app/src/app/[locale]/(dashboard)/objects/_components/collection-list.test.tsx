// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { CollectionList } from "./collection-list";
import type { ColumnConfig } from "./column-config";
import type { ViewMode } from "./view-toggle";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
  usePermissions: () => ({ hasPermission: () => true, isLoading: false }),
}));

interface Observed {
  notify: () => void;
  root: Element | null;
}
const observers: Observed[] = [];

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: (entries: Array<{ isIntersecting: boolean }>) => void,
        options?: { root?: Element | null },
      ) {
        observers.push({
          notify: () => callback([{ isIntersecting: true }]),
          root: options?.root ?? null,
        });
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderCatalog(
  onLoadMore: (options: { remember: boolean }) => void,
) {
  await renderOnPage(
    <CollectionList
      organizationId={"org" as Id<"organizations">}
      collections={[
        {
          _id: "object-1",
          accessionNumber: "QA-652-1",
          title: "Portrait of the harbourmaster's daughter",
          status: "active",
          _creationTime: Date.UTC(2026, 9, 10),
        },
      ]}
      collectionsStatus="CanLoadMore"
      viewMode="list"
      columns={[]}
      selectedIds={new Set()}
      onSelectItem={() => {}}
      onSelectAll={() => {}}
      onLoadMore={onLoadMore}
      isFiltered
      listRef={{ current: null }}
    />,
    "/en/objects?search=harbourmaster",
  );
  const observer = observers.at(-1);
  if (!observer) throw new Error("the list did not watch for its end");
  return observer;
}

test("results that fit on screen load more without rewriting the remembered depth", async () => {
  const onLoadMore = vi.fn();
  const observer = await renderCatalog(onLoadMore);

  act(() => observer.notify());

  expect(onLoadMore).toHaveBeenCalledWith({ remember: false });
});

test("scrolling to the end of a long list remembers how far it was loaded", async () => {
  const onLoadMore = vi.fn();
  const observer = await renderCatalog(onLoadMore);
  if (observer.root) {
    Object.defineProperty(observer.root, "scrollTop", { value: 480 });
  }

  act(() => observer.notify());

  expect(onLoadMore).toHaveBeenCalledWith({ remember: true });
});

const DATED_OBJECTS = [
  {
    _id: "object-1",
    accessionNumber: "QA-857-1",
    title: "Harbour chart",
    status: "active",
    _creationTime: Date.UTC(2026, 9, 10),
    dateCreated: "c. 1850",
    dateCreatedEdtf: "1849/1851",
  },
  {
    _id: "object-2",
    accessionNumber: "QA-857-2",
    title: "Amphora",
    status: "active",
    _creationTime: Date.UTC(2026, 9, 11),
    dateCreatedEdtf: "-0499~",
  },
  {
    _id: "object-3",
    accessionNumber: "QA-857-3",
    title: "Undated box",
    status: "active",
    _creationTime: Date.UTC(2026, 9, 12),
  },
];

async function renderDatedCatalog(viewMode: ViewMode, columns: ColumnConfig[]) {
  await renderOnPage(
    <CollectionList
      organizationId={"org" as Id<"organizations">}
      collections={DATED_OBJECTS}
      collectionsStatus="Exhausted"
      viewMode={viewMode}
      columns={columns}
      selectedIds={new Set()}
      onSelectItem={() => {}}
      onSelectAll={() => {}}
      onLoadMore={() => {}}
      listRef={{ current: null }}
    />,
    "/en/objects?sort=madeEarliest",
  );
}

test("the Date made column shows the date as written, else the structured date, else a dash", async () => {
  await renderDatedCatalog("list", []);

  const column = screen
    .getAllByRole("columnheader")
    .findIndex((header) => header.textContent === "Date made");
  expect(column).toBeGreaterThan(0);
  const dateMade = (title: string) =>
    within(screen.getByRole("row", { name: new RegExp(title) }))
      .getAllByRole("cell")
      .at(column)?.textContent;
  expect(dateMade("Harbour chart")).toBe("c. 1850");
  expect(dateMade("Amphora")).toBe("c. 500 BC");
  expect(dateMade("Undated box")).toBe("-");
});

test("the Date made column can be hidden", async () => {
  await renderDatedCatalog("list", [
    { id: "dateMade", label: "Date made", visible: false },
  ]);

  expect(screen.queryByRole("columnheader", { name: "Date made" })).toBeNull();
  expect(screen.queryByText("c. 1850")).toBeNull();
});

test("grid cards carry the same date made line", async () => {
  await renderDatedCatalog("grid", []);

  expect(screen.getByText("c. 1850")).toBeTruthy();
  expect(screen.getByText("c. 500 BC")).toBeTruthy();
  const undated = screen.getByRole("heading", { name: "Undated box" });
  expect(undated.nextElementSibling?.textContent).toBe("-");
});
