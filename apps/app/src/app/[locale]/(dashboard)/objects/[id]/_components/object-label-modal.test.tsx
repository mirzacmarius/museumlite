// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ObjectLabelModal } from "./object-label-modal";
import { QRLabelModal } from "./qr-label-modal";
import type { CollectionData } from "./types";

const FIXED_COLOR =
  /^(?:bg|text|border|accent)-(?:white|black|\[#|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d)/;

function fixedColorClasses(elements: Element[]) {
  return elements.flatMap((element) =>
    [...element.classList].filter((name) => {
      const variants = name.split(":");
      const utility = variants.pop() ?? "";
      return !variants.includes("print") && FIXED_COLOR.test(utility);
    }),
  );
}

test("only the printed label keeps fixed colors in Print Object Label", async () => {
  await renderOnPage(
    <ObjectLabelModal
      isOpen
      onClose={() => {}}
      qrCodeUrl="https://app.museumlite.com/en/objects/object-1"
      collection={{
        _id: "object-1" as Id<"collections">,
        title: "Bronze coin",
        description: "Roman bronze coin",
        accessionNumber: "112-2026-0003",
      }}
    />,
  );

  const paper = screen
    .getByText("(112-2026-0003)")
    .closest('[class~="bg-white"]');
  if (!paper) throw new Error("The label preview has no white paper");
  expect(fixedColorClasses([paper])).toEqual([
    "bg-white",
    "text-black",
    "border-black",
  ]);

  const dialog = screen.getByRole("dialog", { name: "Print Object Label" });
  const chrome = [dialog, ...dialog.querySelectorAll("*")].filter(
    (element) => !paper.contains(element),
  );
  expect(fixedColorClasses(chrome)).toEqual([]);
});

test("only the printed label keeps fixed colors in Print QR Label", async () => {
  await renderOnPage(
    <QRLabelModal
      isOpen
      onClose={() => {}}
      qrCodeUrl="https://app.museumlite.com/en/objects/object-1"
      collection={
        {
          _id: "object-1" as Id<"collections">,
          title: "Bronze coin",
          accessionNumber: "112-2026-0003",
        } as CollectionData
      }
    />,
  );

  const paper = screen
    .getByText("112-2026-0003")
    .closest('[class~="bg-white"]');
  if (!paper) throw new Error("The label preview has no white paper");

  const dialog = screen.getByRole("dialog", { name: "Print QR Label" });
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  const chrome = [dialog, ...dialog.querySelectorAll("*")].filter(
    (element) => !paper.contains(element),
  );
  expect(fixedColorClasses(chrome)).toEqual([]);
});
