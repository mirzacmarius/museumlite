// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { measurementSetsFromEntries } from "./measurement-sets";
import { MeasurementSetsField } from "./measurement-sets-field";
import type { CollectionFormData } from "./types";

const ROW = {
  partNote: "",
  height: "",
  width: "",
  depth: "",
  diameter: "",
  weight: "",
  unit: "",
  weightUnit: "",
};

/** The values the form opens with; each test sets its own before rendering. */
let opened: CollectionFormData = { title: "Vase" };
/** The values after the last change. */
let latest: CollectionFormData = opened;

function Field({ error }: { error?: string }) {
  const [formData, setFormData] = useState(opened);
  latest = formData;
  return (
    <MeasurementSetsField
      formData={formData}
      updateField={(field, value) =>
        setFormData((current) => ({ ...current, [field]: value }))
      }
      fieldErrors={error ? { measurementSets: error } : {}}
    />
  );
}

test("staff add a measured part, choose it and give its measurements", async () => {
  opened = { title: "Vase" };
  await renderOnPage(<Field />);
  const user = userEvent.setup();

  expect(screen.queryByRole("combobox", { name: "Measured part" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Add measured part" }));

  const part = screen.getByRole("combobox", { name: "Measured part" });
  expect(part.textContent).toBe("Choose a part");
  await user.click(part);
  const options = screen.getAllByRole("option").map((o) => o.textContent);
  expect(options).not.toContain("Not stated");
  expect(options).toContain("Framed");
  await user.click(screen.getByRole("option", { name: "Framed" }));
  await user.type(screen.getByRole("textbox", { name: "Height" }), "60");
  await user.type(screen.getByRole("textbox", { name: "Unit" }), "cm");
  await user.type(screen.getByRole("textbox", { name: "Weight" }), "3");

  expect(measurementSetsFromEntries(latest.measurementSets)).toEqual([
    { part: "framed", height: 60, unit: "cm", weight: 3 },
  ]);
});

test("each row is removed on its own", async () => {
  opened = {
    title: "Vase",
    measurementSets: [
      { ...ROW, localId: "a", part: "framed", height: "60" },
      { ...ROW, localId: "b", part: "base", partNote: "plinth" },
    ],
  };
  await renderOnPage(<Field />);
  const user = userEvent.setup();

  const removes = screen.getAllByRole("button", {
    name: "Remove measured part",
  });
  expect(removes).toHaveLength(2);
  await user.click(removes[0] as HTMLElement);

  expect(latest.measurementSets).toEqual([
    { ...ROW, localId: "b", part: "base", partNote: "plinth" },
  ]);
  expect(
    screen.getByRole("textbox", { name: "Part note" }).getAttribute("value"),
  ).toBe("plinth");
});

test("the list's error marks only the rows it is about", async () => {
  opened = {
    title: "Vase",
    measurementSets: [
      { ...ROW, localId: "a", part: "framed", height: "60" },
      { ...ROW, localId: "b", width: "12" },
    ],
  };
  await renderOnPage(
    <Field error="Choose the part each row of measurements was taken from." />,
  );

  expect(
    screen.getByText(
      "Choose the part each row of measurements was taken from.",
    ),
  ).toBeTruthy();
  const [first, second] = screen.getAllByRole("combobox", {
    name: "Measured part",
  });
  expect(first?.getAttribute("aria-invalid")).not.toBe("true");
  expect(second?.getAttribute("aria-invalid")).toBe("true");
  const widths = screen.getAllByRole("textbox", { name: "Width" });
  expect(widths[0]?.getAttribute("aria-invalid")).not.toBe("true");
  expect(widths[1]?.getAttribute("aria-invalid")).toBe("true");
});
