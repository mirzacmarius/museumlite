"use client";

import { useRouter } from "next/navigation";
import {
  NewLoanBasicsSection,
  NewLoanFormActions,
  NewLoanItemsSection,
  NewLoanPageHeader,
  NewLoanScheduleSection,
  NewLoanSummarySidebar,
  useNewLoanForm,
} from "./_components";

export default function NewLoanPage() {
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
          Please select an organization to create loans.
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
              Create New Loan
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Register a new incoming or outgoing loan record.
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
