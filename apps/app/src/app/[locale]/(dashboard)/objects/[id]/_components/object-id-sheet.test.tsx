// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ObjectIdSheet } from "./object-id-sheet";
import { objectIdCategoryValues } from "./object-id-sheet-data";

test("every checklist category is printed, recorded or not", async () => {
  await renderOnPage(
    <ObjectIdSheet
      title="Bronze coin"
      accessionNumber="112-2026-0003"
      organizationName="Home Museum"
      printedOn="24 October 2026"
      values={objectIdCategoryValues({
        collection: {
          title: "Bronze coin",
          objectType: "Coin",
          creator: "Mint of Rome",
        },
        distinguishingFeatures: [],
      })}
      featuresFromAssessment={false}
      description={undefined}
      images={[]}
    />,
  );

  const sheet = screen.getByRole("article");
  expect(within(sheet).getByText("Home Museum")).toBeTruthy();
  expect(within(sheet).getByText("112-2026-0003")).toBeTruthy();
  expect(within(sheet).getByText("Printed on 24 October 2026")).toBeTruthy();
  for (const heading of [
    "Type of object",
    "Materials and techniques",
    "Measurements",
    "Inscriptions and markings",
    "Distinguishing features",
    "Title",
    "Subject",
    "Date or period",
    "Maker",
  ]) {
    expect(within(sheet).getByText(heading)).toBeTruthy();
  }
  expect(within(sheet).getByText("Coin")).toBeTruthy();
  expect(within(sheet).getByText("Mint of Rome")).toBeTruthy();
  // Six categories plus the short description are not recorded.
  expect(within(sheet).getAllByText("Not recorded")).toHaveLength(7);
  expect(within(sheet).getByText("No photograph recorded")).toBeTruthy();
});

test("the primary photograph prints large and up to three more as thumbnails", async () => {
  await renderOnPage(
    <ObjectIdSheet
      title="Bronze coin"
      accessionNumber="112-2026-0003"
      printedOn="24 October 2026"
      values={objectIdCategoryValues({
        collection: { title: "Bronze coin" },
        distinguishingFeatures: ["Chip on the rim"],
      })}
      featuresFromAssessment
      description="A worn bronze coin."
      images={[1, 2, 3, 4, 5].map((n) => ({
        id: `m${n}`,
        url: `https://files.example/${n}.jpg`,
        thumbnailUrl: `https://files.example/${n}-thumb.jpg`,
      }))}
    />,
  );

  const photographs = screen.getByRole("region", { name: "Photographs" });
  const images = within(photographs).getAllByRole("img");
  expect(images).toHaveLength(4);
  expect(images[0]?.getAttribute("alt")).toBe("Bronze coin");
  expect(images[1]?.getAttribute("alt")).toBe("Bronze coin (2)");
  expect(
    screen.getByText("From the accepted condition assessment"),
  ).toBeTruthy();
  expect(screen.getByText("A worn bronze coin.")).toBeTruthy();
});
