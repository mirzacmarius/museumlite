import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
  "utf8",
);

test("new account window fills the dashboard pane without overflowing it", () => {
  expect(source).toContain(
    'className="flex h-full min-h-0 w-full bg-background px-4 py-4 sm:px-6 sm:py-6"',
  );
  expect(source).toContain(
    'className="z-10 mx-auto flex h-full min-h-0 w-full max-w-screen-md flex-col overflow-hidden rounded-lg border border-border bg-card"',
  );
});

test("new account form body scrolls and keeps create actions visible", () => {
  expect(source).toContain('className="flex min-h-0 flex-1 flex-col"');
  expect(source).toContain(
    'className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto p-6"',
  );
  expect(source).toContain(
    'className="flex shrink-0 justify-end gap-4 border-t border-border px-6 py-4"',
  );
});
