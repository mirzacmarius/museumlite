// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { DatePicker } from "./date-picker";

const LAST_OF_JANUARY = new Date(2026, 0, 31);

test("the field is named by its label and the date it shows", () => {
  render(
    <DatePicker
      id="endDate"
      label="End date"
      date={LAST_OF_JANUARY}
      displayFormat="d MMM yyyy"
    />,
  );

  expect(
    screen.getByRole("button", { name: "End date 31 Jan 2026" }),
  ).toBeTruthy();
});

test("a date in error says so and is described by its message", () => {
  render(
    <>
      <DatePicker
        id="endDate"
        label="End date"
        placeholder="Pick a date"
        aria-invalid
        aria-describedby="endDate-error"
      />
      <p id="endDate-error">The end date cannot be before the start date.</p>
    </>,
  );

  const field = screen.getByRole("button", { name: "End date Pick a date" });
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(field.getAttribute("aria-describedby")).toBe("endDate-error");
});

test("opening the calendar starts on the chosen day, so arrow keys move from it", async () => {
  const user = userEvent.setup();
  render(
    <DatePicker
      id="endDate"
      label="End date"
      date={LAST_OF_JANUARY}
      displayFormat="d MMM yyyy"
    />,
  );

  screen.getByRole("button", { name: "End date 31 Jan 2026" }).focus();
  await user.keyboard("{Enter}");

  expect(document.activeElement?.getAttribute("aria-label") ?? "").toMatch(
    /January 31st, 2026/,
  );
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement?.getAttribute("aria-label") ?? "").toMatch(
    /January 30th, 2026/,
  );
});
