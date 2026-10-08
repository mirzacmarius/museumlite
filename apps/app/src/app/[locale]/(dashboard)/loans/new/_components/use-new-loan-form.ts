"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { loanAgreementTemplateErrorFromError } from "@v1/backend/convex/utils/loanAgreementErrors";
import { isLoanCurrencyCode } from "@v1/backend/convex/utils/loanCurrency";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useLoanAgreementTemplateErrorMessage } from "@/hooks/use-loan-agreement-template-error-message";
import { useScopedI18n } from "@/locales/client";
import { EMPTY_NEW_LOAN_FORM, type NewLoanFormData } from "./types";

export function useNewLoanForm() {
  const tActions = useScopedI18n("loans.actions");
  const tAgreementErrors = useScopedI18n("loanAgreementTemplates.errors");
  const agreementErrorMessage = useLoanAgreementTemplateErrorMessage();
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createLoan = useMutation(api.loans.create);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] =
    useState<NewLoanFormData>(EMPTY_NEW_LOAN_FORM);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [itemConditions, setItemConditions] = useState<Record<string, string>>(
    {},
  );
  const [problematicCollectionIds, setProblematicCollectionIds] = useState<
    Set<string>
  >(new Set());

  const selectedCollections = useQuery(
    api.collections.getBatch,
    currentOrganizationId && selectedCollectionIds.length > 0
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          collectionIds: selectedCollectionIds as Id<"collections">[],
        }
      : "skip",
  );

  const selectedCollectionsList = selectedCollections ?? [];

  const validCollectionIds = useMemo(() => {
    if (!selectedCollections || selectedCollectionIds.length === 0) {
      return [];
    }
    return selectedCollectionIds.filter((id) =>
      selectedCollections.some((c) => c._id === id),
    );
  }, [selectedCollections, selectedCollectionIds]);

  const collectionsInActiveLoans = useQuery(
    api.loans.checkCollectionsInActiveLoans,
    currentOrganizationId && selectedCollectionIds.length > 0 && !isSubmitting
      ? {
          collectionIds: selectedCollectionIds as Id<"collections">[],
        }
      : "skip",
  );

  useEffect(() => {
    if (collectionsInActiveLoans) {
      const problematicIds = new Set(
        collectionsInActiveLoans.map((item) => item.collectionId),
      );
      setProblematicCollectionIds(problematicIds);
    } else {
      setProblematicCollectionIds(new Set());
    }
  }, [collectionsInActiveLoans]);

  const handleSelectionChange = (ids: string[]) => {
    setSelectedCollectionIds(ids);
    const selectedIdSet = new Set(ids);
    setItemConditions((prev) => {
      const updated = { ...prev };
      for (const id of Object.keys(updated)) {
        if (!selectedIdSet.has(id)) {
          delete updated[id];
        }
      }
      return updated;
    });
  };

  const clearAllCollections = () => {
    setSelectedCollectionIds([]);
    setItemConditions({});
  };

  const removeCollection = (collectionId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.filter((id) => id !== collectionId),
    );
    setItemConditions((prev) => {
      const updated = { ...prev };
      delete updated[collectionId];
      return updated;
    });
    setProblematicCollectionIds((prev) => {
      const updated = new Set(prev);
      updated.delete(collectionId);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentOrganizationId) return;

    if (!formData.lenderBorrowerName.trim()) {
      setError(tActions("lenderBorrowerRequired"));
      return;
    }

    const currency = formData.currency.trim();
    if (currency && !isLoanCurrencyCode(currency)) {
      setError(tAgreementErrors("invalidCurrency"));
      return;
    }

    if (validCollectionIds.length !== selectedCollectionIds.length) {
      const invalidIds = selectedCollectionIds.filter(
        (id) => !validCollectionIds.includes(id),
      );
      setSelectedCollectionIds(validCollectionIds);
      setItemConditions((prev) => {
        const updated = { ...prev };
        for (const id of invalidIds) {
          delete updated[id];
        }
        return updated;
      });
      setError(tActions("someCollectionsNoLongerAvailable"));
      return;
    }

    if (problematicCollectionIds.size > 0) {
      const problematicList = Array.from(problematicCollectionIds);
      const problematicNames = selectedCollectionsList
        .flatMap((collection) =>
          problematicList.includes(collection._id)
            ? [collection.title || collection.accessionNumber]
            : [],
        )
        .join(", ");

      setError(
        `The following collections are already in active or pending loans and must be removed: ${problematicNames}. Please remove them before creating the loan.`,
      );
      return;
    }

    setProblematicCollectionIds(new Set());
    setIsSubmitting(true);

    try {
      await createLoan({
        organizationId: currentOrganizationId as Id<"organizations">,
        loanNumber: formData.loanNumber || undefined,
        type: formData.type,
        accountId: formData.accountId
          ? (formData.accountId as Id<"accounts">)
          : undefined,
        lenderBorrowerName: formData.lenderBorrowerName,
        lenderBorrowerContact: formData.lenderBorrowerContact || undefined,
        startDate: formData.startDate.getTime(),
        endDate: formData.endDate ? formData.endDate.getTime() : undefined,
        terms: formData.terms || undefined,
        insuranceValue: formData.insuranceValue
          ? Number.parseFloat(formData.insuranceValue)
          : undefined,
        currency: currency || undefined,
        notes: formData.notes || undefined,
        itemsWithConditions:
          validCollectionIds.length > 0
            ? validCollectionIds.map((id) => ({
                collectionId: id as Id<"collections">,
                conditionOut: itemConditions[id] || undefined,
              }))
            : undefined,
      });
      push("/loans");
    } catch (err) {
      console.error("Error creating loan:", err);
      let errorMessage = agreementErrorMessage(
        err,
        tActions("failedToCreateLoan"),
      );

      if (!loanAgreementTemplateErrorFromError(err) && err instanceof Error) {
        if (err.message.includes("already in an active loan")) {
          errorMessage = tActions("alreadyInActiveLoan");
        } else if (err.message.includes("does not belong to organization")) {
          errorMessage = tActions("doesNotBelongToOrganization");
        } else if (err.message.includes("is not active")) {
          errorMessage = tActions("notActive");
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  return {
    currentOrganizationId,
    formData,
    setFormData,
    selectedCollectionIds,
    itemConditions,
    setItemConditions,
    problematicCollectionIds,
    selectedCollectionsList,
    collectionsInActiveLoans,
    isSubmitting,
    error,
    handleSubmit,
    handleSelectionChange,
    clearAllCollections,
    removeCollection,
  };
}

export type NewLoanFormState = ReturnType<typeof useNewLoanForm>;
