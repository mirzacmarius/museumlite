// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { AccessionTab } from "./accession-tab";
import { GeneralTab } from "./general-tab";
import { PhysicalTab } from "./physical-tab";
import type { CollectionData } from "./types";

vi.mock("./condition-summary-card", () => ({
  ConditionSummaryCard: () => null,
}));
vi.mock("./object-incidents", () => ({ ObjectIncidents: () => null }));

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

let organizationDefault: string | undefined = IN_COPYRIGHT;
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(reference as never) === "organizations:get"
      ? {
          _id: "org",
          settings: {
            rightsDefaults: organizationDefault
              ? { objectRightsStatement: organizationDefault }
              : {},
          },
        }
      : undefined;
  },
}));

afterEach(() => {
  organizationDefault = IN_COPYRIGHT;
});

const object = {
  _id: "object-1",
  organizationId: "org",
  title: "Tea set",
} as CollectionData;

function fieldValue(label: string) {
  const field = screen.getByText(label).parentElement;
  return field?.lastElementChild?.textContent;
}

test("the General tab shows the number of objects and the subject terms", async () => {
  await renderOnPage(
    <GeneralTab
      collection={{
        ...object,
        numberOfObjects: 12000,
        subjects: ["Tea", "Chinoiserie"],
      }}
    />,
  );

  expect(fieldValue("Number of objects")).toBe("12,000");
  const terms = screen.getAllByRole("listitem").map((item) => item.textContent);
  expect(terms).toEqual(["Tea", "Chinoiserie"]);
});

test("the Physical tab names the measured part, further parts and completeness", async () => {
  await renderOnPage(
    <PhysicalTab
      collection={{
        ...object,
        dimensionHeight: 60,
        dimensionWidth: 45.5,
        dimensionUnit: "cm",
        dimensionMeasuredPart: "framed",
        measurementSets: [
          { part: "other", partNote: "lid", diameter: 8.5, unit: "cm" },
          { part: "base", weight: 2, weightUnit: "kg" },
        ],
        completeness: "incomplete",
        completenessNote: "One cup missing",
      }}
    />,
  );

  expect(fieldValue("Dimensions")).toBe("H: 60 × W: 45.5 cm");
  expect(fieldValue("Measured part")).toBe("Framed");
  expect(
    screen.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual(["Other (lid): Ø 8.5 cm", "Base: 2 kg"]);
  expect(screen.getByText("Incomplete")).toBeTruthy();
  expect(screen.getByText("One cup missing")).toBeTruthy();
});

test("the Physical tab reads measurements in the app language", async () => {
  await renderOnPage(
    <PhysicalTab
      collection={{
        ...object,
        dimensionHeight: 60,
        dimensionWidth: 45.5,
        dimensionUnit: "cm",
        dimensionMeasuredPart: "framed",
      }}
    />,
    "/no",
  );

  expect(screen.getByText("H: 60 × B: 45,5 cm")).toBeTruthy();
  expect(screen.getByText("Med ramme")).toBeTruthy();
});

test("without further parts or completeness, the Physical tab says nothing is recorded", async () => {
  await renderOnPage(<PhysicalTab collection={object} />);

  expect(screen.queryByText("Further measured parts")).toBeNull();
  expect(fieldValue("Measured part")).toBe("-");
  expect(fieldValue("Completeness")).toBe("-");
});

test("the Accession tab links the Object's own rights statement", async () => {
  await renderOnPage(
    <AccessionTab collection={{ ...object, rightsStatement: CC_BY }} />,
  );

  const link = screen.getByRole("link", {
    name: "Creative Commons Attribution 4.0 International",
  });
  expect(link.getAttribute("href")).toBe(CC_BY);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(screen.queryByText("Organization default")).toBeNull();
});

test("the Accession tab shows the organization's default when the Object has none", async () => {
  await renderOnPage(<AccessionTab collection={object} />);

  expect(
    screen.getByRole("link", { name: "In Copyright" }).getAttribute("href"),
  ).toBe(IN_COPYRIGHT);
  expect(screen.getByText("Organization default")).toBeTruthy();
});

test("the Accession tab shows a dash when no statement applies", async () => {
  organizationDefault = undefined;
  await renderOnPage(<AccessionTab collection={object} />);

  expect(screen.queryByRole("link")).toBeNull();
  expect(fieldValue("Rights statement")).toBe("-");
});
