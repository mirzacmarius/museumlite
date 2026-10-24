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

function readBack() {
  return document.getElementById("dateCreated-reading")?.textContent ?? "";
}

test("the form has no structured date field, only Date made and how it reads", async () => {
  await renderOnPage(<Form initial={{ dateCreated: "c. 1850" }} />);

  expect(readBack()).toContain(
    "Read as c. 1850. Sorting and filters use 1845 – 1855.",
  );
  expect(readBack()).toContain("EDTF 1850~");
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

test("text the catalog cannot read is kept as written and sorts as undated", async () => {
  await renderOnPage(<Form initial={{ dateCreated: "Ming dynasty" }} />);

  expect(readBack()).toBe(
    "Not read as a date, so it is shown as written. Sorting and date filters treat the Object as undated.",
  );
});

test("a structured date saved earlier is kept when Date made is edited, and counts instead", async () => {
  const onChange = vi.fn<OnChange>();
  await renderOnPage(
    <Form
      initial={{
        dateCreated: "Ming dynasty",
        dateCreatedEdtf: draftFromEdtf("1368/1644"),
      }}
      onChange={onChange}
    />,
  );

  expect(readBack()).toContain("Sorting and filters use 1368 – 1644.");
  expect(readBack()).toContain("EDTF 1368/1644");

  await userEvent.type(screen.getByRole("textbox"), ", Jiajing");

  const saved: Mock<OnChange>["mock"]["lastCall"] = onChange.mock.lastCall;
  expect(saved?.[0].dateCreated).toBe("Ming dynasty, Jiajing");
  expect(edtfFromDraft(saved?.[0].dateCreatedEdtf)).toBe("1368/1644");
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
    "The text reads as 1850, but the structured date is 1860. Sorting, filters and exports use the structured date.Use the text insteadSorting and filters use 1860.EDTF 1860",
  );
});

test("staff can drop a structured date that disagrees with the text, so the text counts", async () => {
  const onChange = vi.fn<OnChange>();
  await renderOnPage(
    <Form
      initial={{
        dateCreated: "1850",
        dateCreatedEdtf: draftFromEdtf("1860"),
      }}
      onChange={onChange}
    />,
  );

  await userEvent.click(
    screen.getByRole("button", { name: "Use the text instead" }),
  );

  expect(readBack()).toBe(
    "Read as 1850. Sorting and filters use 1850.EDTF 1850",
  );
  expect(
    edtfFromDraft(onChange.mock.lastCall?.[0].dateCreatedEdtf),
  ).toBeUndefined();
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Date made" }),
  );
});

test("an error on the structured date is announced on Date made", async () => {
  const message = "Check the structured date.";
  await renderOnPage(
    <Form
      initial={{ dateCreatedEdtf: draftFromEdtf("1850/1860") }}
      fieldErrors={{ dateCreatedEdtf: message }}
    />,
  );

  const error = screen.getByText(message);
  const dateMade = screen.getByRole("textbox", { name: "Date made" });
  expect(dateMade.getAttribute("aria-invalid")).toBe("true");
  expect(dateMade.getAttribute("aria-describedby")).toBe(
    `dateCreated-reading ${error.id}`,
  );
  expect(error.id).toBe("dateCreatedEdtf-error");
});
