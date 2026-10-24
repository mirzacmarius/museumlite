// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { DonationDetailsField } from "./donation-details-field";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

async function renderField(
  values: { donatedBy?: string[]; donatedDate?: string; donationInfo?: string },
  locale = "en",
) {
  const handlers = {
    onDonatedByChange: vi.fn(),
    onDonatedDateChange: vi.fn(),
    onDonationInfoChange: vi.fn(),
  };
  await renderOnPage(
    <DonationDetailsField
      donatedBy={values.donatedBy ?? []}
      donatedDate={values.donatedDate}
      donationInfo={values.donationInfo}
      {...handlers}
    />,
    `/${locale}/objects/new`,
  );
  return { user: userEvent.setup(), ...handlers };
}

test("entered donation details read as a summary with Edit and Delete in a menu", async () => {
  const { user } = await renderField({
    donatedBy: ["Klara Kjøge"],
    donatedDate: "1984",
    donationInfo: "Given to the lodge in Fredrikstad",
  });

  expect(screen.getByText("Klara Kjøge")).toBeTruthy();
  expect(screen.getByText("1984")).toBeTruthy();
  expect(screen.getByText("Given to the lodge in Fredrikstad")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
  expect(
    screen.getByRole("textbox", { name: "Info about the Donation" }),
  ).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Finish editing" }));
  expect(
    screen.queryByRole("textbox", { name: "Info about the Donation" }),
  ).toBeNull();
  expect(screen.getByText("Klara Kjøge")).toBeTruthy();
});

test("Delete clears the donor, the date and the notes", async () => {
  const { user, ...handlers } = await renderField({
    donatedBy: ["Klara Kjøge"],
    donatedDate: "1984",
  });

  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

  expect(handlers.onDonatedByChange).toHaveBeenCalledWith([]);
  expect(handlers.onDonatedDateChange).toHaveBeenCalledWith("");
  expect(handlers.onDonationInfoChange).toHaveBeenCalledWith("");
});

test("without donation details the field offers to add them", async () => {
  const { user } = await renderField({});

  await user.click(screen.getByRole("button", { name: "Add Donated by" }));

  expect(
    screen.getByRole("textbox", { name: "Info about the Donation" }),
  ).toBeTruthy();
});

test("unknown donors are named in the viewer's language", async () => {
  await renderField({ donatedBy: ["Unknown donors"] }, "no");

  expect(screen.getByText("Ukjente givere")).toBeTruthy();
});

test("the summary shows the donation date in the reader's language", async () => {
  await renderField(
    { donatedBy: ["Klara Kjøge"], donatedDate: "1984-05-14" },
    "no",
  );

  expect(screen.getByText("14. mai 1984")).toBeTruthy();
});
