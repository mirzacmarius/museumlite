import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "account-combobox-create-dialog.tsx",
  ),
  "utf8",
);

test("create account dialog is capped to the viewport", () => {
  expect(source).toContain(
    'className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden"',
  );
});

test("create account dialog scrolls fields and pins create actions", () => {
  expect(source).toContain(
    'className="grid min-h-0 flex-1 gap-4 overflow-y-auto py-2 custom-scrollbar"',
  );
  expect(source).toContain('className="shrink-0 border-t border-border pt-4"');
});
