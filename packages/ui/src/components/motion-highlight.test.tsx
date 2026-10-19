// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

function highlightedText() {
  const highlights = document.querySelectorAll("[data-slot=highlight]");
  expect(highlights).toHaveLength(1);
  return highlights[0]?.parentElement?.textContent;
}

test("the menu highlight follows the highlighted item", async () => {
  const user = userEvent.setup();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.keyboard("{ArrowDown}");
  expect(highlightedText()).toBe("Edit");

  await user.keyboard("{ArrowDown}");

  expect(highlightedText()).toBe("Duplicate");
});

test("the command list highlight follows the selected item", async () => {
  const user = userEvent.setup();
  render(
    <Command label="Go to">
      <CommandInput />
      <CommandList>
        <CommandGroup>
          <CommandItem>Objects</CommandItem>
          <CommandItem>Loans</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>,
  );
  await waitFor(() => expect(highlightedText()).toBe("Objects"));

  await user.click(screen.getByRole("combobox"));
  await user.keyboard("{ArrowDown}");

  expect(highlightedText()).toBe("Loans");
});
