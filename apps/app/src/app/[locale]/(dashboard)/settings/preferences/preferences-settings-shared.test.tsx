// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { PreferenceSwitch } from "./preferences-settings-shared";

function DeaccessionWorkflow({
  onCheckedChange,
}: {
  onCheckedChange: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(true);
  return (
    <PreferenceSwitch
      id="deaccessionWorkflowEnabled"
      label="Deaccession workflow"
      description="Deaccession requests require approval before objects are removed."
      checked={checked}
      onCheckedChange={(next) => {
        setChecked(next);
        onCheckedChange(next);
      }}
    />
  );
}

test("clicking a preference's name or description leaves it unchanged", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  await renderOnPage(<DeaccessionWorkflow onCheckedChange={onCheckedChange} />);
  const control = screen.getByRole("switch", {
    name: "Deaccession workflow",
    description:
      "Deaccession requests require approval before objects are removed.",
  });

  await user.click(screen.getByText("Deaccession workflow"));
  await user.click(
    screen.getByText(
      "Deaccession requests require approval before objects are removed.",
    ),
  );

  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(onCheckedChange).not.toHaveBeenCalled();
  expect(control.getAttribute("aria-checked")).toBe("true");
});

test("a preference changes only once its switch is confirmed", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  await renderOnPage(<DeaccessionWorkflow onCheckedChange={onCheckedChange} />);
  const control = screen.getByRole("switch", { name: "Deaccession workflow" });

  await user.click(control);
  screen.getByRole("heading", {
    name: "Are you sure you want to disable this function?",
  });
  screen.getByText("Setting: Deaccession workflow");
  screen.getByText("The change takes effect when you save.");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCheckedChange).not.toHaveBeenCalled();
  expect(control.getAttribute("aria-checked")).toBe("true");

  await user.click(control);
  await user.click(screen.getByRole("button", { name: "Disable" }));
  expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(false);
  expect(control.getAttribute("aria-checked")).toBe("false");
});
