import { RIGHTS_STATEMENTS } from "@v1/backend/convex/utils/rightsStatements";
import { expect, test } from "vitest";
import {
  RIGHTS_STATEMENT_GROUPS,
  shownRightsStatement,
} from "./rights-statements";

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

test("the picker groups every statement by who publishes it", () => {
  expect(RIGHTS_STATEMENT_GROUPS.map((group) => group.kind)).toEqual([
    "rightsstatements",
    "creativecommons",
  ]);
  expect(
    RIGHTS_STATEMENT_GROUPS.flatMap((group) =>
      group.statements.map((statement) => statement.code),
    ),
  ).toEqual(RIGHTS_STATEMENTS.map((statement) => statement.code));
});

test("a record's own statement is shown over its organization's default", () => {
  expect(shownRightsStatement(CC_BY, IN_COPYRIGHT)).toEqual({
    statement: expect.objectContaining({ code: "CC_BY", uri: CC_BY }),
    inherited: false,
  });
});

test("without its own statement a record shows the default as inherited", () => {
  expect(shownRightsStatement(undefined, IN_COPYRIGHT)).toEqual({
    statement: expect.objectContaining({ code: "InC" }),
    inherited: true,
  });
  expect(shownRightsStatement(undefined, undefined)).toBeUndefined();
});
