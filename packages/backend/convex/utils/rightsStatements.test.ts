import { describe, expect, it } from "vitest";
import {
  isRightsStatementUri,
  normalizeRightsStatement,
  RIGHTS_STATEMENTS,
  rightsStatementByUri,
  rightsStatementInEffect,
} from "./rightsStatements";

const IN_COPYRIGHT = "http://rightsstatements.org/vocab/InC/1.0/";
const IN_COPYRIGHT_EDUCATIONAL =
  "http://rightsstatements.org/vocab/InC-EDU/1.0/";
const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";
const PUBLIC_DOMAIN_MARK = "https://creativecommons.org/publicdomain/mark/1.0/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
const CC_BY_SA = "https://creativecommons.org/licenses/by-sa/4.0/";
const CC_BY_NC = "https://creativecommons.org/licenses/by-nc/4.0/";

describe("rights statements", () => {
  it("lists the twenty statements by their canonical URIs", () => {
    expect(RIGHTS_STATEMENTS.map((statement) => statement.uri)).toEqual([
      "http://rightsstatements.org/vocab/InC/1.0/",
      "http://rightsstatements.org/vocab/InC-OW-EU/1.0/",
      "http://rightsstatements.org/vocab/InC-EDU/1.0/",
      "http://rightsstatements.org/vocab/InC-NC/1.0/",
      "http://rightsstatements.org/vocab/InC-RUU/1.0/",
      "http://rightsstatements.org/vocab/NoC-CR/1.0/",
      "http://rightsstatements.org/vocab/NoC-NC/1.0/",
      "http://rightsstatements.org/vocab/NoC-OKLR/1.0/",
      "http://rightsstatements.org/vocab/NoC-US/1.0/",
      "http://rightsstatements.org/vocab/CNE/1.0/",
      "http://rightsstatements.org/vocab/UND/1.0/",
      "http://rightsstatements.org/vocab/NKC/1.0/",
      "https://creativecommons.org/publicdomain/zero/1.0/",
      "https://creativecommons.org/publicdomain/mark/1.0/",
      "https://creativecommons.org/licenses/by/4.0/",
      "https://creativecommons.org/licenses/by-sa/4.0/",
      "https://creativecommons.org/licenses/by-nc/4.0/",
      "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      "https://creativecommons.org/licenses/by-nd/4.0/",
      "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    ]);
    expect(
      RIGHTS_STATEMENTS.filter(
        (statement) => statement.kind === "rightsstatements",
      ),
    ).toHaveLength(12);
    for (const statement of RIGHTS_STATEMENTS) {
      expect(rightsStatementByUri(statement.uri)).toBe(statement);
      expect(isRightsStatementUri(statement.uri)).toBe(true);
      // Every canonical URI and short label reads as itself.
      expect(normalizeRightsStatement(statement.uri)).toBe(statement.uri);
      expect(normalizeRightsStatement(statement.shortLabel)).toBe(
        statement.uri,
      );
    }
    expect(isRightsStatementUri("https://example.com/rights")).toBe(false);
    expect(rightsStatementByUri(undefined)).toBeUndefined();
  });

  it("reads the other scheme, a missing slash and the publishers' web pages", () => {
    expect(
      normalizeRightsStatement("https://rightsstatements.org/vocab/InC/1.0"),
    ).toBe(IN_COPYRIGHT);
    expect(
      normalizeRightsStatement(
        "http://rightsstatements.org/page/InC-EDU/1.0/?language=fr",
      ),
    ).toBe(IN_COPYRIGHT_EDUCATIONAL);
    expect(
      normalizeRightsStatement("  RIGHTSSTATEMENTS.ORG/page/inc-edu/1.0  "),
    ).toBe(IN_COPYRIGHT_EDUCATIONAL);
    expect(
      normalizeRightsStatement("http://creativecommons.org/licenses/by/4.0"),
    ).toBe(CC_BY);
    expect(
      normalizeRightsStatement(
        "https://creativecommons.org/licenses/by-sa/4.0/deed.no",
      ),
    ).toBe(CC_BY_SA);
    expect(
      normalizeRightsStatement(
        "https://creativecommons.org/licenses/by/4.0/legalcode.fr",
      ),
    ).toBe(CC_BY);
    expect(
      normalizeRightsStatement(
        "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
      ),
    ).toBe(CC0);
    expect(
      normalizeRightsStatement("www.creativecommons.org/publicdomain/mark/1.0"),
    ).toBe(PUBLIC_DOMAIN_MARK);
  });

  it("reads short codes in any letter case", () => {
    expect(normalizeRightsStatement("InC")).toBe(IN_COPYRIGHT);
    expect(normalizeRightsStatement("inc-edu")).toBe(IN_COPYRIGHT_EDUCATIONAL);
    expect(normalizeRightsStatement("InC EDU 1.0")).toBe(
      IN_COPYRIGHT_EDUCATIONAL,
    );
    expect(normalizeRightsStatement("NoC_US")).toBe(
      "http://rightsstatements.org/vocab/NoC-US/1.0/",
    );
    expect(normalizeRightsStatement("CC0")).toBe(CC0);
    expect(normalizeRightsStatement("cc zero 1.0")).toBe(CC0);
    expect(normalizeRightsStatement("PDM")).toBe(PUBLIC_DOMAIN_MARK);
    expect(normalizeRightsStatement("CC BY 4.0")).toBe(CC_BY);
    expect(normalizeRightsStatement("CC-BY-SA-4.0")).toBe(CC_BY_SA);
    expect(normalizeRightsStatement("by-nc 4.0")).toBe(CC_BY_NC);
  });

  it("refuses other licence versions and anything it does not know", () => {
    for (const text of [
      "https://creativecommons.org/licenses/by/3.0/",
      "http://creativecommons.org/licenses/by-sa/2.0/deed.en",
      "CC BY 3.0",
      "CC BY-SA",
      "CC BY",
      "https://creativecommons.org/licenses/by-xx/4.0/",
      "http://rightsstatements.org/vocab/InC/2.0/",
      "https://example.org/vocab/InC/1.0/",
      "https://example.org/InC",
      "Copyright the artist",
      "All rights reserved",
      "",
      "   ",
      null,
      undefined,
    ])
      expect(normalizeRightsStatement(text)).toBeUndefined();
  });

  it("applies the Object's own statement, otherwise the Organization's default", () => {
    expect(rightsStatementInEffect(CC0, IN_COPYRIGHT)).toBe(CC0);
    expect(rightsStatementInEffect(undefined, IN_COPYRIGHT)).toBe(IN_COPYRIGHT);
    expect(rightsStatementInEffect(undefined, undefined)).toBeUndefined();
  });
});
