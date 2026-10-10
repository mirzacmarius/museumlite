// @vitest-environment jsdom
import { act } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { CollectionList } from "./collection-list";

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
