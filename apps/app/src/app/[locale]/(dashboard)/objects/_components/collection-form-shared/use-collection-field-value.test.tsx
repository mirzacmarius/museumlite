// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { draftFromEdtf } from "@/components/production-date/production-date-draft";
import {
  type RecordFormNoticeSession,
  RecordFormNotices,
} from "@/components/record-form/record-form-notices";
import { renderOnPage } from "@/testing/render-on-page";
import { useCollectionFieldLabel } from "./use-collection-field-label";
import { useCollectionFieldValue } from "./use-collection-field-value";

const idle: RecordFormNoticeSession = {
  recoveryOffer: null,
  restoreRecovered: () => {},
  discardRecovered: () => {},
  remote: null,
  applyLatest: () => {},
  discardChanges: () => {},
  overlaps: {},
  takeTheirValue: () => {},
  keepMyValue: () => {},
  failure: null,
  retry: async () => true,
  saving: false,
  keepsDeviceCopy: true,
};

function Notices({ overlaps }: { overlaps: Record<string, unknown> }) {
  return (
    <RecordFormNotices
      session={{ ...idle, overlaps }}
      fieldLabel={useCollectionFieldLabel()}
      fieldValue={useCollectionFieldValue()}
    />
  );
}

test("a colleague's structured date made shows as the date it states", async () => {
  await renderOnPage(
    <Notices
      overlaps={{
        dateCreatedEdtf: draftFromEdtf("1850~"),
        culture: "Roman",
      }}
    />,
  );

  expect(
    screen.getByText(
      "Structured date was also changed by someone else, to “c. 1850”",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("Culture was also changed by someone else, to “Roman”"),
  ).toBeTruthy();
});

test("a colleague who cleared the structured date made is named without a value", async () => {
  await renderOnPage(
    <Notices overlaps={{ dateCreatedEdtf: draftFromEdtf(undefined) }} />,
  );

  expect(
    screen.getByText("Structured date was also changed by someone else."),
  ).toBeTruthy();
});

test("a colleague's description values show as names, numbers and lists", async () => {
  await renderOnPage(
    <Notices
      overlaps={{
        numberOfObjects: "12000",
        subjects: ["Tea", "Chinoiserie"],
        completeness: "fragment",
        completenessNote: "Shards only",
        dimensionMeasuredPart: "framed",
        measurementSets: [
          {
            localId: "row-1",
            part: "other",
            partNote: "lid",
            height: "",
            width: "",
            depth: "",
            diameter: "8,5",
            weight: "",
            unit: "cm",
            weightUnit: "",
          },
        ],
        rightsStatement: "http://rightsstatements.org/vocab/InC/1.0/",
      }}
    />,
  );

  for (const notice of [
    "Number of objects was also changed by someone else, to “12,000”",
    "Subject was also changed by someone else, to “Tea, Chinoiserie”",
    "Completeness was also changed by someone else, to “Fragment”",
    "Completeness note was also changed by someone else, to “Shards only”",
    "Measured part was also changed by someone else, to “Framed”",
    "Further measured parts was also changed by someone else, to “Other (lid): Ø 8.5 cm”",
    "Rights statement was also changed by someone else, to “In Copyright”",
  ]) {
    expect(screen.getByText(notice)).toBeTruthy();
  }
});

test("a colleague who cleared a description field is named without a value", async () => {
  await renderOnPage(
    <Notices
      overlaps={{
        numberOfObjects: "",
        rightsStatement: undefined,
        measurementSets: [],
      }}
    />,
  );

  for (const notice of [
    "Number of objects was also changed by someone else.",
    "Rights statement was also changed by someone else.",
    "Further measured parts was also changed by someone else.",
  ]) {
    expect(screen.getByText(notice)).toBeTruthy();
  }
});
