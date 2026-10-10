import type { QueryCtx } from "../_generated/server";
import {
  insuranceSchedulePage,
  valuationPage,
} from "./financialReportSources";
import { PROVENANCE_SOURCES } from "./provenanceReportSources";
import {
  accessionPage,
  disposalPage,
  type RegisterPage,
  type RegisterScope,
  SUBJECT_SOURCES,
  subjectPage,
} from "./registerSources";

/** One bounded page of any register or report profile. */
export async function readRegisterPage(
  ctx: QueryCtx,
  scope: RegisterScope,
  cursor: string | null,
): Promise<RegisterPage> {
  switch (scope.profile) {
    case "accession":
      return accessionPage(ctx, scope, cursor);
    case "disposal":
      return disposalPage(ctx, scope, cursor);
    case "custody":
    case "condition":
      return subjectPage(ctx, scope, SUBJECT_SOURCES[scope.profile], cursor);
    case "valuation":
      return valuationPage(ctx, scope, cursor);
    case "insurance":
      return insuranceSchedulePage(ctx, scope, cursor);
    case "provenance":
      return subjectPage(ctx, scope, PROVENANCE_SOURCES, cursor);
  }
}
