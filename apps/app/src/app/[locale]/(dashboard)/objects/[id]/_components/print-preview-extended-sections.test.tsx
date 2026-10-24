// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { PrintPreviewExtendedSections } from "./print-preview-extended-sections";
import type { CollectionData } from "./types";

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";

/** What api.organizations.get serves; undefined while it loads. */
let organization: unknown;
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) =>
    args !== "skip" &&
    getFunctionName(reference as never) === "organizations:get"
      ? organization
      : undefined,
}));

afterEach(() => {
  organization = undefined;
});

const object = {
  _id: "object-1",
  organizationId: "org",
  title: "Tea set",
} as CollectionData;

function rightsStatement() {
  const label = screen.getByText("Rights statement");
  return label.nextElementSibling?.textContent;
}

async function renderSections(collection: CollectionData = object) {
  await renderOnPage(
    <PrintPreviewExtendedSections
      collection={collection}
      locationPath={undefined}
      locale="en"
    />,
  );
}

test("while the Organization's default loads, no statement is printed", async () => {
  await renderSections();

  expect(rightsStatement()).toBe("");
  expect(screen.queryByText("Not stated")).toBeNull();
});

test("the Object's own statement is printed before the default loads", async () => {
  await renderSections({ ...object, rightsStatement: IN_COPYRIGHT });

  expect(rightsStatement()).toBe("In Copyright");
});

test("an Object without its own statement prints the Organization's default", async () => {
  organization = {
    _id: "org",
    settings: { rightsDefaults: { objectRightsStatement: IN_COPYRIGHT } },
  };
  await renderSections();

  expect(rightsStatement()).toBe("In Copyright");
  expect(
    screen.getByText(`${IN_COPYRIGHT} · Organization default`),
  ).toBeTruthy();
});

test("without a default, the print says the statement is not stated", async () => {
  organization = { _id: "org", settings: {} };
  await renderSections();

  expect(rightsStatement()).toBe("Not stated");
});
