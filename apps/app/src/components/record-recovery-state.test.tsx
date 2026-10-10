// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { RecordRecoveryState } from "./record-recovery-state";

/** An object page; a colleague's removal reaches it as a new render. */
function ObjectPage({ removed }: { removed: boolean }) {
  return (
    <>
      <input aria-label="Search everything" />
      {removed ? (
        <RecordRecoveryState kind="removed" list="objects" />
      ) : (
        <button type="button">Edit object</button>
      )}
    </>
  );
}

const RETURN = encodeURIComponent("/objects?status=loaned");

test("when the record goes from under focus, focus moves to why and what to do", async () => {
  const user = userEvent.setup();
  const { rerender } = await renderOnPage(
    <ObjectPage removed={false} />,
    `/en/objects/o1?from=${RETURN}`,
  );
  screen.getByRole("button", { name: "Edit object" }).focus();

  rerender(<ObjectPage removed />);

  expect(document.activeElement).toBe(
    screen.getByRole("heading", {
      name: "This record is no longer available",
    }),
  );
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "Back to results" }),
  );
});

test("focus elsewhere on the page stays where it is", async () => {
  const { rerender } = await renderOnPage(
    <ObjectPage removed={false} />,
    "/en/objects/o1",
  );
  const search = screen.getByRole("textbox", { name: "Search everything" });
  search.focus();

  rerender(<ObjectPage removed />);

  expect(
    screen.getByRole("heading", { name: "This record is no longer available" }),
  ).toBeTruthy();
  expect(document.activeElement).toBe(search);
});
