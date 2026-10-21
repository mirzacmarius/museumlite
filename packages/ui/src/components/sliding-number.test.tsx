// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SlidingNumber } from "./sliding-number";

test("reads as exactly its value, digits included only once", () => {
  render(
    <p>
      <SlidingNumber value="1,234" />
    </p>,
  );

  expect(screen.getByText("1,234").closest("[aria-hidden]")).toBeNull();
  expect(screen.getByRole("paragraph").textContent).toBe("1,234");
});

test("reads as the new value as soon as the value changes", () => {
  const { rerender } = render(
    <p>
      <SlidingNumber value={98} />
    </p>,
  );

  rerender(
    <p>
      <SlidingNumber value={102} />
    </p>,
  );

  expect(screen.getByRole("paragraph").textContent).toBe("102");
});
