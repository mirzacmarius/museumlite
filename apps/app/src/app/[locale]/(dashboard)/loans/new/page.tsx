"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/locales/client";
import { NewLoanBasicsSection } from "./_components/new-loan-basics-section";
import { NewLoanFormActions } from "./_components/new-loan-form-actions";
import { NewLoanItemsSection } from "./_components/new-loan-items-section";
import { NewLoanPageHeader } from "./_components/new-loan-page-header";
import { NewLoanScheduleSection } from "./_components/new-loan-schedule-section";
import { NewLoanSummarySidebar } from "./_components/new-loan-summary-sidebar";
import { useNewLoanForm } from "./_components/use-new-loan-form";
export default function NewLoanPage() {
  const tRoot = useI18n();
  const { back } = useRouter();
  const {
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
  } = useNewLoanForm();

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">
          {tRoot("loans.actions.pleaseSelectOrganization")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <NewLoanPageHeader />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8 pb-20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {tRoot("loans.actions.createNewLoan")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tRoot("loans.actions.registerNewLoan")}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-8">
              <NewLoanBasicsSection
                organizationId={currentOrganizationId}
                formData={formData}
                onFormDataChange={setFormData}
              />

              <NewLoanScheduleSection
                formData={formData}
                onFormDataChange={setFormData}
              />

              <NewLoanItemsSection
                organizationId={currentOrganizationId}
                selectedCollectionIds={selectedCollectionIds}
                selectedCollectionsList={selectedCollectionsList}
                itemConditions={itemConditions}
                problematicCollectionIds={problematicCollectionIds}
                collectionsInActiveLoans={collectionsInActiveLoans}
                onSelectionChange={handleSelectionChange}
                onConditionChange={(collectionId, value) =>
                  setItemConditions((prev) => ({
                    ...prev,
                    [collectionId]: value,
                  }))
                }
                onRemoveCollection={removeCollection}
                onClearAll={clearAllCollections}
              />

              <NewLoanFormActions
                error={error}
                isSubmitting={isSubmitting}
                onCancel={() => back()}
              />
            </div>

            <NewLoanSummarySidebar
              formData={formData}
              selectedCollectionIds={selectedCollectionIds}
              selectedCollectionsList={selectedCollectionsList}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
