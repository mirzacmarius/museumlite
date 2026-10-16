// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ConfirmedSwitch } from "./confirmed-switch";

function AutoGeneration({
  onConfirmedChange,
}: {
  onConfirmedChange: (checked: boolean) => void | Promise<void>;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <ConfirmedSwitch
      settingName="Auto-generation"
      checked={checked}
      onConfirmedChange={(next) => {
        setChecked(next);
        return onConfirmedChange(next);
      }}
    />
  );
}

test("turning a switch on asks first, and Cancel leaves it off", async () => {
  const user = userEvent.setup();
  const onConfirmedChange = vi.fn();
  await renderOnPage(<AutoGeneration onConfirmedChange={onConfirmedChange} />);
  const control = screen.getByRole("switch", { name: "Auto-generation" });

  await user.click(control);

  const dialog = screen.getByRole("alertdialog");
  within(dialog).getByRole("heading", {
    name: "Are you sure you want to enable this function?",
  });
  within(dialog).getByText("“Auto-generation” will be turned on.");
  expect(control.getAttribute("aria-checked")).toBe("false");

  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(onConfirmedChange).not.toHaveBeenCalled();
  expect(control.getAttribute("aria-checked")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(control));
});

test("confirming applies the change", async () => {
  const user = userEvent.setup();
  const onConfirmedChange = vi.fn();
  await renderOnPage(<AutoGeneration onConfirmedChange={onConfirmedChange} />);
  const control = screen.getByRole("switch", { name: "Auto-generation" });

  await user.click(control);
  await user.click(screen.getByRole("button", { name: "Enable" }));

  expect(onConfirmedChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(control.getAttribute("aria-checked")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(control));
});

test("the keyboard goes through the same confirmation, on and off", async () => {
  const user = userEvent.setup();
  const onConfirmedChange = vi.fn();
  await renderOnPage(<AutoGeneration onConfirmedChange={onConfirmedChange} />);
  const control = screen.getByRole("switch", { name: "Auto-generation" });

  await user.tab();
  expect(document.activeElement).toBe(control);
  await user.keyboard(" ");
  screen.getByRole("heading", {
    name: "Are you sure you want to enable this function?",
  });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(onConfirmedChange).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(control));

  await user.keyboard(" ");
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    ),
  );
  await user.tab();
  await user.keyboard("{Enter}");
  expect(onConfirmedChange).toHaveBeenLastCalledWith(true);
  await waitFor(() => expect(document.activeElement).toBe(control));

  await user.keyboard(" ");
  const dialog = screen.getByRole("alertdialog");
  within(dialog).getByRole("heading", {
    name: "Are you sure you want to disable this function?",
  });
  within(dialog).getByText("“Auto-generation” will be turned off.");
  await user.click(within(dialog).getByRole("button", { name: "Disable" }));

  expect(onConfirmedChange).toHaveBeenLastCalledWith(false);
  expect(onConfirmedChange).toHaveBeenCalledTimes(2);
  expect(control.getAttribute("aria-checked")).toBe("false");
});

test("while a confirmed change is saving, the switch keeps focus and ignores further presses", async () => {
  const user = userEvent.setup();
  let finishSaving = () => {};
  const onConfirmedChange = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishSaving = resolve;
      }),
  );
  await renderOnPage(<AutoGeneration onConfirmedChange={onConfirmedChange} />);
  const control = screen.getByRole("switch", { name: "Auto-generation" });

  await user.click(control);
  await user.click(screen.getByRole("button", { name: "Enable" }));
  expect(control.getAttribute("aria-busy")).toBe("true");

  await user.click(control);
  expect(screen.queryByRole("alertdialog")).toBeNull();

  await act(async () => finishSaving());
  expect(control.getAttribute("aria-busy")).toBeNull();
  expect(onConfirmedChange).toHaveBeenCalledOnce();
  await waitFor(() => expect(document.activeElement).toBe(control));
});
