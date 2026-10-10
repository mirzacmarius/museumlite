// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { RecordSaveFailure } from "@/lib/record-form";
import { renderOnPage } from "@/testing/render-on-page";
import {
  FieldError,
  fieldErrorProps,
  type RecordFormNoticeSession,
  RecordFormNotices,
} from "./record-form-notices";

const labels: Record<string, string> = {
  lenderBorrowerName: "Lender name",
  endDate: "End date",
  insuranceValue: "Insurance value",
  currentLocationId: "Current location",
};

const idle: RecordFormNoticeSession = {
  recoveryOffer: null,
  restoreRecovered: () => {},
  discardRecovered: () => {},
  remote: null,
  applyLatest: () => {},
  discardChanges: () => {},
  overlaps: {},
  takeTheirValue: () => {},
  keepMyValue: () => {},
  failure: null,
  retry: async () => true,
  saving: false,
  keepsDeviceCopy: true,
};

const NO_FIELD_ERRORS: Record<string, string> = {};
const ignoreGoToField = () => {};

/** A loan form whose fields show the errors of its last save. */
function LoanForm({
  failure,
  fieldErrors = NO_FIELD_ERRORS,
  onGoToField = ignoreGoToField,
}: {
  failure: RecordSaveFailure | null;
  fieldErrors?: Record<string, string>;
  onGoToField?: (field: string) => void;
}) {
  return (
    <form>
      <RecordFormNotices
        session={{ ...idle, failure }}
        fieldLabel={(field) => labels[field] ?? field}
        onGoToField={onGoToField}
      />
      {["lenderBorrowerName", "endDate", "insuranceValue"].map((field) => (
        <div key={field}>
          <label htmlFor={field}>{labels[field]}</label>
          <input id={field} {...fieldErrorProps(field, fieldErrors[field])} />
          <FieldError field={field} message={fieldErrors[field]} />
        </div>
      ))}
      <button type="submit">Save changes</button>
    </form>
  );
}

test("a save refused for invalid fields focuses the first one staff see", async () => {
  const { rerender } = await renderOnPage(<LoanForm failure={null} />);
  screen.getByRole("button", { name: "Save changes" }).focus();

  // The checks report fields in their own order, not the form's.
  rerender(
    <LoanForm
      failure={{
        kind: "invalid",
        message: "Some fields need attention.",
        fields: ["insuranceValue", "endDate"],
      }}
      fieldErrors={{
        insuranceValue: "Enter an amount of 0 or more.",
        endDate: "The end date cannot be before the start date.",
      }}
    />,
  );

  const endDate = screen.getByRole("textbox", { name: "End date" });
  await waitFor(() => expect(document.activeElement).toBe(endDate));
  expect(endDate.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(endDate.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("The end date cannot be before the start date.");
  // One announcement for the save; each field's message is read with it.
  const alerts = screen.getAllByRole("alert");
  expect(alerts).toHaveLength(1);
  expect(alerts[0]?.textContent).toContain("Some fields need attention.");
});

test("a field refused on another tab is shown through the form", async () => {
  const onGoToField = vi.fn();
  const { rerender } = await renderOnPage(<LoanForm failure={null} />);

  rerender(
    <LoanForm
      failure={{
        kind: "field",
        message: "That location is no longer available.",
        field: "currentLocationId",
      }}
      fieldErrors={{
        currentLocationId: "That location is no longer available.",
      }}
      onGoToField={onGoToField}
    />,
  );

  await waitFor(() =>
    expect(onGoToField).toHaveBeenCalledWith("currentLocationId"),
  );
});

test("a save that failed for no field's reason focuses the notice that explains it", async () => {
  const { rerender } = await renderOnPage(<LoanForm failure={null} />);

  rerender(
    <LoanForm
      failure={{
        kind: "denied",
        message:
          "Your role does not include access to this. Ask an administrator to update your role.",
      }}
    />,
  );

  const notice = screen.getByRole("alert");
  await waitFor(() =>
    expect(document.activeElement?.contains(notice)).toBe(true),
  );
});

test("focus is not pulled back while staff work on a refused save", async () => {
  const failure: RecordSaveFailure = {
    kind: "invalid",
    message: "Some fields need attention.",
    fields: ["endDate"],
  };
  const fieldErrors = {
    endDate: "The end date cannot be before the start date.",
  };
  const { rerender } = await renderOnPage(
    <LoanForm failure={failure} fieldErrors={fieldErrors} />,
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "End date" }),
    ),
  );
  const insurance = screen.getByRole("textbox", { name: "Insurance value" });
  insurance.focus();

  // The form renders again (staff type) with a new goToField each time.
  rerender(
    <LoanForm
      failure={failure}
      fieldErrors={fieldErrors}
      onGoToField={() => {}}
    />,
  );

  expect(document.activeElement).toBe(insurance);
});
