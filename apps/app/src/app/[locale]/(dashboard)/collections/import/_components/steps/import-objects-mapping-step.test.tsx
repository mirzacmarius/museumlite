// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { EMPTY_IMPORT_STATE } from "../import-objects-types";
import { ImportObjectsMappingStep } from "./import-objects-mapping-step";

test("columns named like the app's Norwegian fields map to number of objects, subject, completeness, measured part and rights statement, each saying what it accepts (MUS-865)", async () => {
  const onSaveMappings = vi.fn();
  await renderOnPage(
    <ImportObjectsMappingStep
      state={{
        ...EMPTY_IMPORT_STATE,
        step: "mapping",
        sourceFields: [
          "Tittel",
          "Antall objekter",
          "Emne",
          "Fullstendighet",
          "Målt del",
          "Rettighetserklæring",
        ],
      }}
      common={(key) => key}
      onReset={vi.fn()}
      onTemplateSelect={vi.fn()}
      getInitialMappings={() => undefined}
      onSaveMappings={onSaveMappings}
    />,
    "/no/collections/import",
  );

  for (const description of [
    "Én av complete, incomplete eller fragment",
    "Hva objektet viser eller handler om; skill termene med semikolon",
    "Delen målene er tatt av: overall, framed, unframed, image, sight, sheet, plate, mount, base eller other",
  ]) {
    expect(screen.getByText(description)).toBeTruthy();
  }
  expect(
    screen.getByText(/som URI eller en kode som InC, CC0 eller CC BY 4\.0$/),
  ).toBeTruthy();

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Lagre tilordninger" }));

  expect(onSaveMappings).toHaveBeenCalledWith([
    { sourceField: "Tittel", targetField: "title" },
    { sourceField: "Antall objekter", targetField: "numberOfObjects" },
    { sourceField: "Emne", targetField: "subjects" },
    { sourceField: "Fullstendighet", targetField: "completeness" },
    { sourceField: "Målt del", targetField: "dimensionMeasuredPart" },
    { sourceField: "Rettighetserklæring", targetField: "rightsStatement" },
  ]);
});
