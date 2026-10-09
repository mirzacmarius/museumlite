"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useState } from "react";

/** Select value for the built-in standard agreement. */
export const STANDARD_AGREEMENT = "standard";

/**
 * Offers the organization's templates for a loan, preselects the default and
 * loads the chosen template. A null template means the standard agreement.
 */
export function useLoanAgreementTemplate({
  loanId,
  organizationId,
}: {
  loanId: Id<"loans">;
  organizationId: Id<"organizations">;
}) {
  const offer = useQuery(api.loanAgreementTemplates.listForLoan, { loanId });
  const [choice, setChoice] = useState<string | null>(null);

  const templates = offer?.templates ?? [];
  const findTemplate = (id: string | null | undefined) =>
    templates.find((template) => template._id === id);
  const selected =
    choice === STANDARD_AGREEMENT
      ? undefined
      : (findTemplate(choice) ?? findTemplate(offer?.defaultTemplateId));
  const template = useQuery(
    api.loanAgreementTemplates.get,
    selected ? { organizationId, templateId: selected._id } : "skip",
  );

  return {
    isLoading: offer === undefined || (selected && template === undefined),
    templates,
    selectedValue: selected?._id ?? STANDARD_AGREEMENT,
    selectTemplate: setChoice,
    template: selected ? (template ?? null) : null,
  };
}
