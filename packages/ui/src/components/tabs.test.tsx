// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function indicatorTab() {
  const indicators = document.querySelectorAll("[data-slot=tabs-indicator]");
  expect(indicators).toHaveLength(1);
  return indicators[0]?.closest("[role=tab]")?.textContent;
}

test("the indicator follows the chosen tab", async () => {
  const user = userEvent.setup();
  render(
    <Tabs defaultValue="import">
      <TabsList>
        <TabsTrigger value="import">Import</TabsTrigger>
        <TabsTrigger value="export">Export</TabsTrigger>
      </TabsList>
      <TabsContent value="import">Import panel</TabsContent>
      <TabsContent value="export">Export panel</TabsContent>
    </Tabs>,
  );
  expect(indicatorTab()).toBe("Import");

  await user.click(screen.getByRole("tab", { name: "Export" }));

  expect(indicatorTab()).toBe("Export");
  screen.getByText("Export panel");
});

test("controlled tabs move the indicator only when the owner changes the value", async () => {
  const user = userEvent.setup();
  function Controlled() {
    const [view, setView] = useState("open");
    return (
      <Tabs
        value={view}
        onValueChange={(next) => setView(next === "closed" ? next : "open")}
      >
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>
    );
  }
  render(<Controlled />);

  await user.click(screen.getByRole("tab", { name: "Closed" }));
  expect(indicatorTab()).toBe("Closed");

  await user.click(screen.getByRole("tab", { name: "Archived" }));
  expect(indicatorTab()).toBe("Open");
});
