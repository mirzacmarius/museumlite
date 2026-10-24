import { type Infer, v } from "convex/values";

/**
 * The rights statements an Object or an image can carry: the twelve
 * RightsStatements.org statements, CC0, the Public Domain Mark and the six
 * Creative Commons 4.0 licences. Each is stored as its canonical URI, the
 * form its publisher uses (see ADR 0022). `code` is a key-safe name for
 * labels; `shortLabel` is the publisher's own short name.
 */
export const RIGHTS_STATEMENTS = [
  {
    code: "InC",
    shortLabel: "InC",
    uri: "http://rightsstatements.org/vocab/InC/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "InC_OW_EU",
    shortLabel: "InC-OW-EU",
    uri: "http://rightsstatements.org/vocab/InC-OW-EU/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "InC_EDU",
    shortLabel: "InC-EDU",
    uri: "http://rightsstatements.org/vocab/InC-EDU/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "InC_NC",
    shortLabel: "InC-NC",
    uri: "http://rightsstatements.org/vocab/InC-NC/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "InC_RUU",
    shortLabel: "InC-RUU",
    uri: "http://rightsstatements.org/vocab/InC-RUU/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "NoC_CR",
    shortLabel: "NoC-CR",
    uri: "http://rightsstatements.org/vocab/NoC-CR/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "NoC_NC",
    shortLabel: "NoC-NC",
    uri: "http://rightsstatements.org/vocab/NoC-NC/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "NoC_OKLR",
    shortLabel: "NoC-OKLR",
    uri: "http://rightsstatements.org/vocab/NoC-OKLR/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "NoC_US",
    shortLabel: "NoC-US",
    uri: "http://rightsstatements.org/vocab/NoC-US/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "CNE",
    shortLabel: "CNE",
    uri: "http://rightsstatements.org/vocab/CNE/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "UND",
    shortLabel: "UND",
    uri: "http://rightsstatements.org/vocab/UND/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "NKC",
    shortLabel: "NKC",
    uri: "http://rightsstatements.org/vocab/NKC/1.0/",
    kind: "rightsstatements",
  },
  {
    code: "CC0",
    shortLabel: "CC0 1.0",
    uri: "https://creativecommons.org/publicdomain/zero/1.0/",
    kind: "creativecommons",
  },
  {
    code: "PDM",
    shortLabel: "PDM 1.0",
    uri: "https://creativecommons.org/publicdomain/mark/1.0/",
    kind: "creativecommons",
  },
  {
    code: "CC_BY",
    shortLabel: "CC BY 4.0",
    uri: "https://creativecommons.org/licenses/by/4.0/",
    kind: "creativecommons",
  },
  {
    code: "CC_BY_SA",
    shortLabel: "CC BY-SA 4.0",
    uri: "https://creativecommons.org/licenses/by-sa/4.0/",
    kind: "creativecommons",
  },
  {
    code: "CC_BY_NC",
    shortLabel: "CC BY-NC 4.0",
    uri: "https://creativecommons.org/licenses/by-nc/4.0/",
    kind: "creativecommons",
  },
  {
    code: "CC_BY_NC_SA",
    shortLabel: "CC BY-NC-SA 4.0",
    uri: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    kind: "creativecommons",
  },
  {
    code: "CC_BY_ND",
    shortLabel: "CC BY-ND 4.0",
    uri: "https://creativecommons.org/licenses/by-nd/4.0/",
    kind: "creativecommons",
  },
  {
    code: "CC_BY_NC_ND",
    shortLabel: "CC BY-NC-ND 4.0",
    uri: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    kind: "creativecommons",
  },
] as const satisfies ReadonlyArray<{
  code: string;
  shortLabel: string;
  uri: string;
  kind: "rightsstatements" | "creativecommons";
}>;

export type RightsStatement = (typeof RIGHTS_STATEMENTS)[number];

export const rightsStatementValidator = v.union(
  ...RIGHTS_STATEMENTS.map((statement) => v.literal(statement.uri)),
);

export type RightsStatementUri = Infer<typeof rightsStatementValidator>;
export type RightsStatementCode = RightsStatement["code"];

export function rightsStatementByUri(uri: string | null | undefined) {
  return RIGHTS_STATEMENTS.find((statement) => statement.uri === uri);
}

export function isRightsStatementUri(
  value: string | null | undefined,
): value is RightsStatementUri {
  return rightsStatementByUri(value) !== undefined;
}

/** RightsStatements.org vocabulary pages and URIs, any letter case. */
const RIGHTS_STATEMENTS_ORG =
  /^(?:www\.)?rightsstatements\.org\/(?:vocab|page)\/([a-z-]+)\/1\.0\/?(?:[?#].*)?$/;
/** Creative Commons tools, with a deed or legal code page after the version. */
const CREATIVE_COMMONS_ORG =
  /^(?:www\.)?creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/(\d+\.\d+)(?:\/(?:deed(?:\.[a-z_-]+)?|legalcode(?:\.[a-z_-]+)?)?)?\/?(?:[?#].*)?$/;
const CC_LICENCE_CODE = /^(?:cc-)?(by(?:-[a-z]+)*)-(\d+\.\d+)$/;

function uriOf(code: RightsStatementCode) {
  return RIGHTS_STATEMENTS.find((statement) => statement.code === code)?.uri;
}

function rightsStatementsOrgUri(id: string) {
  const statement = RIGHTS_STATEMENTS.find(
    (candidate) =>
      candidate.kind === "rightsstatements" &&
      candidate.shortLabel.toLowerCase() === id,
  );
  return statement?.uri;
}

function creativeCommonsUri(tool: string, version: string) {
  return RIGHTS_STATEMENTS.find(
    (statement) =>
      statement.kind === "creativecommons" &&
      statement.uri.endsWith(`/${tool}/${version}/`),
  )?.uri;
}

/**
 * The canonical URI a written statement names, for imports: the URI in
 * either scheme, with or without its trailing slash, a RightsStatements.org
 * page (with any `?language=`), a Creative Commons deed or legal code page,
 * or a short code in any case such as "InC-EDU", "CC0", "PDM", "CC BY 4.0"
 * or "CC-BY-SA-4.0". Undefined for anything else, including Creative
 * Commons versions other than the listed ones, which are never upgraded.
 */
export function normalizeRightsStatement(
  text: string | null | undefined,
): RightsStatementUri | undefined {
  const written = text?.trim().toLowerCase();
  if (!written) return undefined;
  const address = written.replace(/^https?:\/\//, "");
  const statementsPage = RIGHTS_STATEMENTS_ORG.exec(address);
  if (statementsPage?.[1]) return rightsStatementsOrgUri(statementsPage[1]);
  const commonsPage = CREATIVE_COMMONS_ORG.exec(address);
  if (commonsPage?.[2] && commonsPage[3]) {
    const tool =
      commonsPage[1] === "publicdomain"
        ? `publicdomain/${commonsPage[2]}`
        : `licenses/${commonsPage[2]}`;
    return creativeCommonsUri(tool, commonsPage[3]);
  }
  if (address !== written) return undefined;
  const code = written.replace(/[\s_]+/g, "-").replace(/-{2,}/g, "-");
  const rightsStatementsCode = rightsStatementsOrgUri(
    code.replace(/-1\.0$/, ""),
  );
  if (rightsStatementsCode) return rightsStatementsCode;
  if (/^cc-?(?:0|zero)(?:-1\.0)?$/.test(code)) return uriOf("CC0");
  if (/^(?:cc-)?pdm(?:-1\.0)?$/.test(code)) return uriOf("PDM");
  const licence = CC_LICENCE_CODE.exec(code);
  return licence?.[1] && licence[2]
    ? creativeCommonsUri(`licenses/${licence[1]}`, licence[2])
    : undefined;
}

/**
 * The statement that applies to a record: its own, otherwise its
 * Organization's default, otherwise none. Read whenever the record is shown
 * or exported, so a changed default applies at once (ADR 0022).
 */
export function rightsStatementInEffect(
  own: RightsStatementUri | undefined,
  organizationDefault: RightsStatementUri | undefined,
): RightsStatementUri | undefined {
  return own ?? organizationDefault;
}
