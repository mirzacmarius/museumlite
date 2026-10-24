"use client";

import {
  isRightsStatementUri,
  type RightsStatementUri,
} from "@v1/backend/convex/utils/rightsStatements";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { RIGHTS_STATEMENT_GROUPS } from "@/lib/rights-statements";
import { useI18n } from "@/locales/client";
import { useRightsStatementName } from "./use-rights-statement-name";

/** The choice that leaves the record without a statement of its own. */
const NO_OWN_STATEMENT = "__default__";

interface RightsStatementSelectProps {
  id: string;
  value: RightsStatementUri | undefined;
  onValueChange: (value: RightsStatementUri | undefined) => void;
  /**
   * The statement that applies without one of the record's own: null when
   * the Organization sets none, undefined while it loads.
   */
  organizationDefault: RightsStatementUri | null | undefined;
}

/**
 * The listed rights statements, grouped by publisher. The empty choice
 * names what applies instead: the Organization's default, or nothing.
 */
export function RightsStatementSelect({
  id,
  value,
  onValueChange,
  organizationDefault,
}: RightsStatementSelectProps) {
  const tRoot = useI18n();
  const name = useRightsStatementName();
  const emptyLabel =
    organizationDefault === undefined
      ? tRoot("rightsStatements.inherited")
      : organizationDefault === null
        ? tRoot("rightsStatements.notStated")
        : tRoot("rightsStatements.organizationDefault", {
            statement: name(organizationDefault),
          });
  return (
    <Select
      value={value ?? NO_OWN_STATEMENT}
      onValueChange={(next) =>
        onValueChange(isRightsStatementUri(next) ? next : undefined)
      }
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_OWN_STATEMENT}>{emptyLabel}</SelectItem>
        {RIGHTS_STATEMENT_GROUPS.map(({ kind, statements }) => (
          <SelectGroup key={kind}>
            <SelectLabel>
              {tRoot(`rightsStatements.groups.${kind}`)}
            </SelectLabel>
            {statements.map((statement) => (
              <SelectItem key={statement.uri} value={statement.uri}>
                {name(statement.uri)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
