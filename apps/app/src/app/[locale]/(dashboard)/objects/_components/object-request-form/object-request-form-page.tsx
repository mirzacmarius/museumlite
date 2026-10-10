"use client";

import { useI18n } from "@/locales/client";
import { ObjectRequestFormLayout } from "./object-request-form-layout";
import {
  type UseObjectRequestFormOptions,
  useObjectRequestForm,
} from "./use-object-request-form";

export type ObjectRequestFormPageProps = UseObjectRequestFormOptions;

export function ObjectRequestFormPage(props: ObjectRequestFormPageProps) {
  const tRoot = useI18n();
  const form = useObjectRequestForm(props);

  if (form.isLocked && !form.hasUnsavedChanges) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.accessions.pendingDraftOnly")}
        </p>
      </div>
    );
  }

  if (!form.currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{form.organizationPrompt}</p>
      </div>
    );
  }

  return <ObjectRequestFormLayout form={form} />;
}
