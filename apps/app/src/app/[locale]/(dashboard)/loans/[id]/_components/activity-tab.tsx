"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { AuditCaseHistory } from "@/components/audit-case-history";

export function ActivityTab({
  organizationId,
  loanId,
}: {
  organizationId: Id<"organizations">;
  loanId: Id<"loans">;
}) {
  return (
    <AuditCaseHistory
      organizationId={organizationId}
      caseId={`loan:${loanId}`}
    />
  );
}
