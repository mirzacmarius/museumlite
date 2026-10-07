import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const APP_SRC = fileURLToPath(
  new URL("../../../apps/app/src", import.meta.url),
);
const LIST_REFERENCE = /api\.collections\.list\b/;
const TYPEOF_LIST = /typeof\s+api\.collections\.list\b/g;

const ALLOWED_LOOPERS = [
  "app/[locale]/(dashboard)/objects/_components/use-collection-catalog-list.ts",
  "components/collection-multi-select-combobox.tsx",
];
// Pages one browse page per user request; queries use searchForSelection.
const ON_DEMAND_PICKER = "hooks/use-object-search-selection.ts";
const EXISTENCE_PROBE = "app/[locale]/onboarding/onboarding-page-client.tsx";

const MIGRATED_CALLERS = [
  "components/object-combobox.tsx",
  "components/collection-selector.tsx",
  "app/[locale]/(dashboard)/loans/[id]/_components/loan-items-manager/use-loan-items-manager.ts",
  "app/[locale]/(dashboard)/collections/[id]/page.tsx",
  "app/[locale]/(dashboard)/loans/new/_components/use-new-loan-form.ts",
];

function walkTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(path));
      continue;
    }
    const endsWith = entry.name.endsWith.bind(entry.name);
    if (endsWith(".test.ts") || endsWith(".test.tsx")) {
      continue;
    }
    if (endsWith(".ts") || endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

function toPosix(path: string): string {
  return relative(APP_SRC, path).split(sep).join("/");
}

function hasRuntimeListReference(source: string): boolean {
  return LIST_REFERENCE.test(source.replace(TYPEOF_LIST, ""));
}

describe("collections.list app importers", () => {
  test("only the looping callers and the on-demand picker import api.collections.list", () => {
    const importers = walkTsFiles(APP_SRC)
      .flatMap((path) =>
        hasRuntimeListReference(readFileSync(path, "utf8"))
          ? [toPosix(path)]
          : [],
      )
      .sort();

    expect(importers).toEqual(
      [...ALLOWED_LOOPERS, ON_DEMAND_PICKER, EXISTENCE_PROBE].sort(),
    );
  });

  test("migrated first-page callers no longer reference api.collections.list", () => {
    for (const path of MIGRATED_CALLERS) {
      const source = readFileSync(join(APP_SRC, path), "utf8");
      expect(hasRuntimeListReference(source), path).toBe(false);
    }
  });
});
