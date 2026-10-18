import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseTaskCaseType } from "@v1/backend/convex/utils/caseTaskValidators";
import { CASE_TYPES, caseHref } from "@v1/backend/convex/utils/caseTypes";
import { expect, test } from "vitest";

const dashboard = fileURLToPath(
  new URL("../../app/[locale]/(dashboard)", import.meta.url),
);

test("every Case link opens an existing case page", () => {
  for (const caseType of Object.keys(CASE_TYPES) as CaseTaskCaseType[]) {
    expect(
      existsSync(join(dashboard, caseHref(caseType, "[id]"), "page.tsx")),
      caseType,
    ).toBe(true);
  }
});
