import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

describe("library items list pagination", () => {
  test("paginates catalog items and supports type filter", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["collections.read", "collections.create"],
      {
        enabledModules: ["library", "accounts"],
        subscriptionTier: "pro",
        slugPrefix: "library-pagination",
      },
    );
    const authed = authedForUser(t, userId);

    await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        authed.mutation(api.library.items.create, {
          organizationId,
          itemType: index % 2 === 0 ? "book" : "dvd",
          title: `Catalog Item ${index + 1}`,
          authors: ["Author"],
          language: "en",
        }),
      ),
    );

    const page1 = await authed.query(api.library.items.list, {
      organizationId,
      paginationOpts: { numItems: 3, cursor: null },
      itemType: "book",
    });

    expect(page1.page).toHaveLength(3);
    expect(page1.isDone).toBe(false);
    expect(page1.page.every((item) => item.itemType === "book")).toBe(true);

    const page2 = await authed.query(api.library.items.list, {
      organizationId,
      paginationOpts: { numItems: 3, cursor: page1.continueCursor },
      itemType: "book",
    });

    expect(page2.page.length).toBeGreaterThan(0);
    expect(page2.page.every((item) => item.itemType === "book")).toBe(true);
  });

  test("returns bounded search matches for non-indexed fields", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["collections.read", "collections.create"],
      {
        enabledModules: ["library", "accounts"],
        subscriptionTier: "pro",
        slugPrefix: "library-search-pagination",
      },
    );
    const authed = authedForUser(t, userId);

    await authed.mutation(api.library.items.create, {
      organizationId,
      itemType: "book",
      title: "Hidden Title",
      authors: ["Author"],
      language: "en",
      isbn13: "9780000000001",
    });

    const searchResult = await authed.query(api.library.items.list, {
      organizationId,
      paginationOpts: { numItems: 10, cursor: null },
      search: "9780000000001",
    });

    expect(searchResult.page).toHaveLength(1);
    expect(searchResult.page[0]?.isbn13).toBe("9780000000001");
  });
});
