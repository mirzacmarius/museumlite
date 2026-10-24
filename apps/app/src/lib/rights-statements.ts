import {
  RIGHTS_STATEMENTS,
  type RightsStatement,
  type RightsStatementUri,
  rightsStatementByUri,
} from "@v1/backend/convex/utils/rightsStatements";

/** Who publishes a statement, which is how pickers group them. */
export type RightsStatementKind = RightsStatement["kind"];

export const RIGHTS_STATEMENT_GROUPS: ReadonlyArray<{
  kind: RightsStatementKind;
  statements: readonly RightsStatement[];
}> = (["rightsstatements", "creativecommons"] as const).map((kind) => ({
  kind,
  statements: RIGHTS_STATEMENTS.filter((statement) => statement.kind === kind),
}));

/** The statement shown for a record, and whether it is the default. */
export interface ShownRightsStatement {
  statement: RightsStatement;
  /** The record has none of its own; its Organization's default applies. */
  inherited: boolean;
}

/**
 * The statement in effect for a record: its own, otherwise its
 * Organization's default (ADR 0022). Undefined when neither is set.
 */
export function shownRightsStatement(
  own: RightsStatementUri | undefined,
  organizationDefault: RightsStatementUri | undefined,
): ShownRightsStatement | undefined {
  const ownStatement = rightsStatementByUri(own);
  if (ownStatement) return { statement: ownStatement, inherited: false };
  const defaultStatement = rightsStatementByUri(organizationDefault);
  return defaultStatement
    ? { statement: defaultStatement, inherited: true }
    : undefined;
}
