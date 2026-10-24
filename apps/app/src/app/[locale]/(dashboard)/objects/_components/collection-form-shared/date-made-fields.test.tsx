// @vitest-environment jsdom

import { screen } from "@testing-library/react";
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
}: {
  initial: Partial<CollectionFormData>;
  onChange?: OnChange;
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
});
