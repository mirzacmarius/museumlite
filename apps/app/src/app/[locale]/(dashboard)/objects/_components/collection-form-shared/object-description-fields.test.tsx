// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { SubjectsField } from "./object-description-fields";
import type { CollectionFormData } from "./types";

/** The values after the last change. */
let latest: CollectionFormData = { title: "Group portrait" };

function Field() {
  const [formData, setFormData] = useState<CollectionFormData>({
    title: "Group portrait",
  });
  latest = formData;
  return (
    <SubjectsField
      formData={formData}
      updateField={(field, value) =>
        setFormData((current) => ({ ...current, [field]: value }))
      }
    />
  );
}

test("a subject heading keeps its comma", async () => {
  await renderOnPage(<Field />);
  const user = userEvent.setup();

  await user.type(
    screen.getByRole("textbox", { name: "Subject" }),
    "Portraits, Group{Enter}",
  );

  expect(latest.subjects).toEqual(["Portraits, Group"]);
});

test("pasted terms are separated by semicolons, as in the import", async () => {
  await renderOnPage(<Field />);
  const user = userEvent.setup();

  await user.click(screen.getByRole("textbox", { name: "Subject" }));
  await user.paste("A; B");

  expect(latest.subjects).toEqual(["A", "B"]);
});
