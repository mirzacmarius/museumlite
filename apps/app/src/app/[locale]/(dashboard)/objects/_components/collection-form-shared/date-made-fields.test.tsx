// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, type Mock, test, vi } from "vitest";
import {
  draftFromEdtf,
  edtfFromDraft,
} from "@/components/production-date/production-date-draft";
import { renderOnPage } from "@/testing/render-on-page";
import { DateMadeFields } from "./date-made-fields";
import type { CollectionFormData } from "./types";
import { createEmptyFormData } from "./utils";

function Form({
  initial,
  onChange = () => {},
  fieldErrors,
}: {
  initial: Partial<CollectionFormData>;
  onChange?: OnChange;
  fieldErrors?: Record<string, string>;
}) {
  const [formData, setFormData] = useState<CollectionFormData>({
    ...createEmptyFormData(),
    ...initial,
  });
  return (
    <DateMadeFields
      formData={formData}
      updateField={(field, value) => {
        const next = { ...formData, [field]: value };
        onChange(next);
        setFormData(next);
      }}
      placeholders={(key) => key}
      fieldErrors={fieldErrors}
    />
  );
}

type OnChange = (formData: CollectionFormData) => void;

function savedEdtf(onChange: Mock<OnChange>) {
  return edtfFromDraft(onChange.mock.lastCall?.[0].dateCreatedEdtf);
}

function readBack() {
  return document.getElementById("dateCreated-reading")?.textContent ?? "";
}

function fromPrecision() {
  return document.getElementById("dateCreatedEdtf-from-precision");
}

test("text the catalog reads shows its years and can become the structured date", async () => {
  const onChange = vi.fn<OnChange>();
  await renderOnPage(
    <Form initial={{ dateCreated: "c. 1850" }} onChange={onChange} />,
  );
  const user = userEvent.setup();

  expect(readBack()).toContain(
    "Read as c. 1850. Sorting and filters use 1845 – 1855.",
  );
  expect(readBack()).toContain("EDTF 1850~");

  await user.click(
    screen.getByRole("button", { name: "Use as structured date" }),
  );
  expect(savedEdtf(onChange)).toBe("1850~");
  expect(onChange.mock.lastCall?.[0]).toMatchObject({ dateCreated: "c. 1850" });
  expect(readBack()).toBe("");
  await waitFor(() => expect(document.activeElement).toBe(fromPrecision()));
});

test("a reading the From and To fields cannot show keeps focus on its Clear button", async () => {
  await renderOnPage(<Form initial={{ dateCreated: "c. 19th century" }} />);
  const user = userEvent.setup();

  await user.click(
    screen.getByRole("button", { name: "Use as structured date" }),
  );

  const clear = screen.getByRole("button", { name: "Clear structured date" });
  await waitFor(() => expect(document.activeElement).toBe(clear));
});

test("text the catalog cannot read is kept as written", async () => {
  await renderOnPage(<Form initial={{ dateCreated: "Ming dynasty" }} />);

  expect(readBack()).toBe(
    "Not read as a date, so it is shown as written. Add a structured date to sort and filter by it.",
  );
  expect(
    screen.queryByRole("button", { name: "Use as structured date" }),
  ).toBeNull();
});

test("a structured date that disagrees with the text says which one counts", async () => {
  await renderOnPage(
    <Form
      initial={{
        dateCreated: "1850",
        dateCreatedEdtf: draftFromEdtf("1860"),
      }}
    />,
  );

  expect(readBack()).toBe(
    "The text reads as 1850, but the structured date is 1860. Sorting, filters and exports use the structured date.",
  );
  expect(screen.getByText("Sorting and filters use 1860.")).toBeTruthy();
});

test("a date the From and To fields cannot show stays until cleared", async () => {
  const onChange = vi.fn<OnChange>();
  await renderOnPage(
    <Form
      initial={{ dateCreatedEdtf: draftFromEdtf("-185X") }}
      onChange={onChange}
    />,
  );
  const user = userEvent.setup();

  expect(screen.getByText("1860 BC – 1851 BC")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Known to" })).toBeNull();

  await user.click(
    screen.getByRole("button", { name: "Clear structured date" }),
  );
  expect(savedEdtf(onChange)).toBeUndefined();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("combobox", { name: "Known to" })).toHaveLength(2);
  await waitFor(() => expect(document.activeElement).toBe(fromPrecision()));
});

test("the structured date's controls are described by its error", async () => {
  const message = "Check the structured date.";
  await renderOnPage(
    <Form
      initial={{ dateCreatedEdtf: draftFromEdtf("1850/1860") }}
      fieldErrors={{ dateCreatedEdtf: message }}
    />,
  );

  const error = screen.getByText(message);
  for (const control of [
    fromPrecision(),
    document.getElementById("dateCreatedEdtf-from-year"),
    document.getElementById("dateCreatedEdtf-to-qualifier"),
  ]) {
    expect(control?.getAttribute("aria-invalid")).toBe("true");
    expect(control?.getAttribute("aria-describedby")).toBe(error.id);
  }
  expect(error.id).toBe("dateCreatedEdtf-error");
});
