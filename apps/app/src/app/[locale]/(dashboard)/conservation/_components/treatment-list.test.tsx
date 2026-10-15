// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { TreatmentList } from "./treatment-list";

const requests = vi.hoisted(() => ({
  args: {} as Record<string, unknown>,
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    requests.args[getFunctionName(query)] = args;
    return { total: 0, byType: [] };
  },
  usePaginatedQuery: (query: never, args: unknown) => {
    requests.args[getFunctionName(query)] = args;
    return { results: [], status: "Exhausted", loadMore: () => {} };
  },
}));

beforeEach(() => {
  requests.args = {};
});

async function renderList(url: string) {
  await renderOnPage(
    <TreatmentList organizationId={"org" as Id<"organizations">} />,
    url,
  );
}

test("a status in the address lists and counts only treatments in it", async () => {
  await renderList("/en/conservation?status=proposed");

  expect(requests.args["conservationTreatments:listPage"]).toEqual({
    organizationId: "org",
    status: "proposed",
  });
  expect(requests.args["conservationTreatments:getListCounts"]).toEqual({
    organizationId: "org",
    status: "proposed",
  });
  expect(
    screen
      .getByRole("button", { name: "Pending approval" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

test("without a status the list shows every treatment", async () => {
  await renderList("/en/conservation");

  expect(requests.args["conservationTreatments:listPage"]).toEqual({
    organizationId: "org",
  });
  expect(
    screen
      .getByRole("button", { name: "Pending approval" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});
