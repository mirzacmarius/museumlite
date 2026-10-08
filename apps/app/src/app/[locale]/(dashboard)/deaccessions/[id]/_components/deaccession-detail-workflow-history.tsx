"use client";

import { AuditCaseHistory } from "@/components/audit-case-history";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

export function DeaccessionDetailWorkflowHistory({
  deaccession,
}: Pick<DeaccessionDetailViewProps, "deaccession">) {
  return (
    <AuditCaseHistory
      organizationId={deaccession.organizationId}
      caseId={`deaccession:${deaccession._id}`}
    />
  );
}
