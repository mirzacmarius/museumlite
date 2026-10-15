// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ObjectTextLabelGenerator } from "./object-text-label-generator";

describe("printed object accession number", () => {
  test.each([
    false,
    true,
  ])("prints only the number with QR code %s", (showQrCode) => {
    const { container } = render(
      <ObjectTextLabelGenerator
        data={{
          objectName: "Bronze coin",
          description: "Roman bronze coin",
          accessionNumber: "112-2026-0003",
        }}
        showQrCode={showQrCode}
        qrCodeUrl="https://app.museumlite.com/en/objects/example"
        qrCodeAlt="Object QR code"
      />,
    );

    expect(screen.getByText("(112-2026-0003)").textContent).toBe(
      "(112-2026-0003)",
    );
    expect(container.textContent).not.toContain("no.:");
    expect(
      screen.queryAllByRole("img", { name: "Object QR code" }),
    ).toHaveLength(showQrCode ? 1 : 0);
  });
});
