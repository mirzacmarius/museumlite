"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { ArrowLeft, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useReducer,
} from "react";
import { AccountCombobox } from "@/components/account-combobox";
import {
  DropzoneUploader,
  type UploadFile,
} from "@/components/dropzone-uploader";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";

type AccessionMethod =
  | "purchase"
  | "gift"
  | "loan"
  | "transfer"
  | "donation"
  | "other"
  | "bequest";

interface NewAccessionFormData {
  accessionNumber: string;
  dateReceived: Date;
  source: string;
  donorAccountId: string | undefined;
  method: AccessionMethod;
  cost: string;
  notes: string;
}

interface UploadedDocument {
  storageId: Id<"_storage">;
  name: string;
}

type SetFormData = Dispatch<SetStateAction<NewAccessionFormData>>;

interface NewAccessionPageState {
  isSubmitting: boolean;
  error: string | null;
  uploadingFiles: UploadFile[];
  uploadedDocuments: UploadedDocument[];
  formData: NewAccessionFormData;
}

type NewAccessionPageAction =
  | { type: "setFormData"; value: NewAccessionFormData }
  | { type: "setError"; value: string | null }
  | { type: "clearError" }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "appendUploadingFiles"; files: UploadFile[] }
  | {
      type: "patchUploadingFiles";
      patch: (files: UploadFile[]) => UploadFile[];
    }
  | { type: "addUploadedDocument"; document: UploadedDocument }
  | { type: "removeUploadedDocument"; storageId: Id<"_storage"> };

const initialNewAccessionPageState: NewAccessionPageState = {
  isSubmitting: false,
  error: null,
  uploadingFiles: [],
  uploadedDocuments: [],
  formData: {
    accessionNumber: "",
    dateReceived: new Date(),
    source: "",
    donorAccountId: undefined,
    method: "purchase",
    cost: "",
    notes: "",
  },
};

function newAccessionPageReducer(
  state: NewAccessionPageState,
  action: NewAccessionPageAction,
): NewAccessionPageState {
  switch (action.type) {
    case "setFormData":
      return { ...state, formData: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "clearError":
      return { ...state, error: null };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "appendUploadingFiles":
      return {
        ...state,
        uploadingFiles: [...state.uploadingFiles, ...action.files],
      };
    case "patchUploadingFiles":
      return {
        ...state,
        uploadingFiles: action.patch(state.uploadingFiles),
      };
    case "addUploadedDocument":
      return {
        ...state,
        uploadedDocuments: [...state.uploadedDocuments, action.document],
      };
    case "removeUploadedDocument":
      return {
        ...state,
        uploadedDocuments: state.uploadedDocuments.filter(
          (doc) => doc.storageId !== action.storageId,
        ),
      };
  }
}

function NewAccessionHeader({ backLabel }: { backLabel: string }) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/accessions">
          <ArrowLeft className="mr-2 size-4" />
          {backLabel}
        </Link>
      </Button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function AccessionIdentityFields({
  formData,
  labels,
  setFormData,
}: {
  formData: NewAccessionFormData;
  labels: {
    accessionNumber: string;
    accessionNumberPlaceholder: string;
    accessionNumberHint: string;
    dateReceived: string;
    dateReceivedPlaceholder: string;
    method: string;
    required: string;
    methods: Record<"purchase" | "gift" | "loan" | "transfer", string>;
  };
  setFormData: SetFormData;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="accessionNumber">{labels.accessionNumber}</Label>
        <Input
          id="accessionNumber"
          value={formData.accessionNumber}
          onChange={(event) =>
            setFormData((prev) => ({
              ...prev,
              accessionNumber: event.target.value,
            }))
          }
          placeholder={labels.accessionNumberPlaceholder}
        />
        <p className="text-xs text-muted-foreground">
          {labels.accessionNumberHint}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DatePicker
          label={
            <>
              {labels.dateReceived} {labels.required}
            </>
          }
          id="dateReceived"
          date={formData.dateReceived}
          onSelect={(date: Date | undefined) =>
            setFormData((prev) => ({
              ...prev,
              dateReceived: date ?? prev.dateReceived,
            }))
          }
          placeholder={labels.dateReceivedPlaceholder}
        />

        <div className="space-y-2">
          <Label htmlFor="method">
            {labels.method} {labels.required}
          </Label>
          <Select
            value={formData.method}
            onValueChange={(value: AccessionMethod) =>
              setFormData((prev) => ({ ...prev, method: value }))
            }
          >
            <SelectTrigger id="method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">
                {labels.methods.purchase}
              </SelectItem>
              <SelectItem value="gift">{labels.methods.gift}</SelectItem>
              <SelectItem value="loan">{labels.methods.loan}</SelectItem>
              <SelectItem value="transfer">
                {labels.methods.transfer}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}

function AccessionSourceFields({
  formData,
  labels,
  organizationId,
  setFormData,
}: {
  formData: NewAccessionFormData;
  labels: {
    donorAccount: string;
    donorAccountPlaceholder: string;
    donorAccountHint: string;
    source: string;
    sourcePlaceholder: string;
    sourceOptional: string;
    sourceRequired: string;
    required: string;
  };
  organizationId: Id<"organizations">;
  setFormData: SetFormData;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="donorAccount">{labels.donorAccount}</Label>
        <AccountCombobox
          organizationId={organizationId}
          value={formData.donorAccountId}
          onValueChange={(accountId) =>
            setFormData((prev) => ({
              ...prev,
              donorAccountId: accountId,
            }))
          }
          placeholder={labels.donorAccountPlaceholder}
        />
        <p className="text-xs text-muted-foreground">
          {labels.donorAccountHint}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source">
          {labels.source} {!formData.donorAccountId && labels.required}
        </Label>
        <Input
          id="source"
          value={formData.source}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, source: event.target.value }))
          }
          placeholder={labels.sourcePlaceholder}
          required={!formData.donorAccountId}
        />
        <p className="text-xs text-muted-foreground">
          {formData.donorAccountId
            ? labels.sourceOptional
            : labels.sourceRequired}
        </p>
      </div>
    </>
  );
}

function AccessionFinancialAndNotesFields({
  formData,
  labels,
  setFormData,
}: {
  formData: NewAccessionFormData;
  labels: {
    cost: string;
    costPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
  };
  setFormData: SetFormData;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="cost">{labels.cost}</Label>
        <Input
          id="cost"
          type="number"
          step="0.01"
          value={formData.cost}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, cost: event.target.value }))
          }
          placeholder={labels.costPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{labels.notes}</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, notes: event.target.value }))
          }
          placeholder={labels.notesPlaceholder}
          rows={4}
        />
      </div>
    </>
  );
}

function SupportingDocumentsField({
  labels,
  onDocumentUpload,
  onRemoveDocument,
  uploadedDocuments,
  uploadingFiles,
}: {
  labels: {
    supportingDocuments: string;
    documentsLabel: string;
    documentsSublabel: string;
  };
  onDocumentUpload: (files: File[]) => void;
  onRemoveDocument: (storageId: Id<"_storage">) => void;
  uploadedDocuments: UploadedDocument[];
  uploadingFiles: UploadFile[];
}) {
  return (
    <div className="space-y-2">
      <Label>{labels.supportingDocuments}</Label>
      <DropzoneUploader
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        multiple
        maxSizeBytes={20 * 1024 * 1024}
        maxFiles={10}
        onFilesSelected={onDocumentUpload}
        uploadingFiles={uploadingFiles}
        label={labels.documentsLabel}
        sublabel={labels.documentsSublabel}
      />
      {uploadedDocuments.length > 0 ? (
        <div className="mt-2 space-y-1">
          {uploadedDocuments.map((document) => (
            <div
              key={document.storageId}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="truncate">{document.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveDocument(document.storageId)}
                className="size-6 p-0"
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewAccessionActions({
  cancelLabel,
  createLabel,
  creatingLabel,
  isSubmitting,
  onCancel,
}: {
  cancelLabel: string;
  createLabel: string;
  creatingLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <PermissionGate permission="collections.create">
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-2 size-4" />
          {isSubmitting ? creatingLabel : createLabel}
        </Button>
      </PermissionGate>
    </div>
  );
}

export default function NewAccessionPage() {
  const t = useScopedI18n("accessions");
  const tRoot = useI18n();
  const { push, back } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createAccession = useMutation(api.accessions.create);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const [state, dispatch] = useReducer(
    newAccessionPageReducer,
    initialNewAccessionPageState,
  );

  const setFormData: SetFormData = useCallback(
    (value) => {
      dispatch({
        type: "setFormData",
        value: typeof value === "function" ? value(state.formData) : value,
      });
    },
    [state.formData],
  );

  const handleDocumentUpload = useCallback(
    async (files: File[]) => {
      const newUploads: UploadFile[] = files.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: "pending" as const,
      }));

      dispatch({ type: "appendUploadingFiles", files: newUploads });

      await Promise.all(
        newUploads.map(async (upload) => {
          try {
            dispatch({
              type: "patchUploadingFiles",
              patch: (prev) =>
                prev.map((u) =>
                  u.id === upload.id ? { ...u, status: "uploading" } : u,
                ),
            });

            const uploadUrl = await generateUploadUrl({
              mimeType: upload.file.type || "application/octet-stream",
            });

            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": upload.file.type },
              body: upload.file,
            });

            if (!response.ok) {
              throw new Error("Upload failed");
            }

            const { storageId } = await response.json();

            dispatch({
              type: "addUploadedDocument",
              document: {
                storageId: storageId as Id<"_storage">,
                name: upload.file.name,
              },
            });

            dispatch({
              type: "patchUploadingFiles",
              patch: (prev) =>
                prev.map((u) =>
                  u.id === upload.id
                    ? { ...u, status: "complete", progress: 100 }
                    : u,
                ),
            });
          } catch (err) {
            console.error("Upload error:", err);
            dispatch({
              type: "patchUploadingFiles",
              patch: (prev) =>
                prev.map((u) =>
                  u.id === upload.id
                    ? {
                        ...u,
                        status: "error",
                        error: tRoot(
                          "untranslatedRecords.accessions.upload.failed",
                        ),
                      }
                    : u,
                ),
            });
          }
        }),
      );

      setTimeout(() => {
        dispatch({
          type: "patchUploadingFiles",
          patch: (prev) => prev.filter((u) => u.status !== "complete"),
        });
      }, 2000);
    },
    [generateUploadUrl, t],
  );

  const handleRemoveDocument = useCallback((storageId: Id<"_storage">) => {
    dispatch({ type: "removeUploadedDocument", storageId });
  }, []);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: "clearError" });
    if (!state.formData.source.trim() && !state.formData.donorAccountId) {
      dispatch({ type: "setError", value: t("form.sourceRequiredError") });
      return;
    }

    dispatch({ type: "setIsSubmitting", value: true });
    try {
      await createAccession({
        organizationId: currentOrganizationId as Id<"organizations">,
        accessionNumber: state.formData.accessionNumber || undefined,
        dateReceived: state.formData.dateReceived.getTime(),
        source: state.formData.source || "See linked account",
        donorAccountId: state.formData.donorAccountId
          ? (state.formData.donorAccountId as Id<"accounts">)
          : undefined,
        documents:
          state.uploadedDocuments.length > 0
            ? state.uploadedDocuments.map((d) => d.storageId)
            : undefined,
        method: state.formData.method,
        cost: state.formData.cost
          ? Number.parseFloat(state.formData.cost)
          : undefined,
        notes: state.formData.notes || undefined,
      });
      push("/accessions");
    } catch (err) {
      console.error("Error creating accession:", err);
      dispatch({
        type: "setError",
        value:
          err instanceof Error ? err.message : t("form.sourceRequiredError"),
      });
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <NewAccessionHeader backLabel={t("backToAccessions")} />

          <form onSubmit={handleSubmit} className="p-6">
            <FormError message={state.error} />
            <div className="mx-auto max-w-2xl space-y-6">
              <AccessionIdentityFields
                formData={state.formData}
                labels={{
                  accessionNumber: t("form.accessionNumber"),
                  accessionNumberPlaceholder: t(
                    "form.accessionNumberPlaceholder",
                  ),
                  accessionNumberHint: t("form.accessionNumberHint"),
                  dateReceived: t("form.dateReceived"),
                  dateReceivedPlaceholder: t("form.dateReceivedPlaceholder"),
                  method: t("form.method"),
                  required: t("form.required"),
                  methods: {
                    purchase: t("form.methods.purchase"),
                    gift: t("form.methods.gift"),
                    loan: t("form.methods.loan"),
                    transfer: t("form.methods.transfer"),
                  },
                }}
                setFormData={setFormData}
              />

              <AccessionSourceFields
                formData={state.formData}
                labels={{
                  donorAccount: t("form.donorAccount"),
                  donorAccountPlaceholder: t("form.donorAccountPlaceholder"),
                  donorAccountHint: t("form.donorAccountHint"),
                  source: t("form.source"),
                  sourcePlaceholder: t("form.sourcePlaceholder"),
                  sourceOptional: t("form.sourceOptional"),
                  sourceRequired: t("form.sourceRequired"),
                  required: t("form.required"),
                }}
                organizationId={currentOrganizationId}
                setFormData={setFormData}
              />

              <AccessionFinancialAndNotesFields
                formData={state.formData}
                labels={{
                  cost: t("form.cost"),
                  costPlaceholder: t("form.costPlaceholder"),
                  notes: t("form.notes"),
                  notesPlaceholder: t("form.notesPlaceholder"),
                }}
                setFormData={setFormData}
              />

              <SupportingDocumentsField
                labels={{
                  supportingDocuments: t("form.supportingDocuments"),
                  documentsLabel: t("form.documentsLabel"),
                  documentsSublabel: t("form.documentsSublabel"),
                }}
                onDocumentUpload={handleDocumentUpload}
                onRemoveDocument={handleRemoveDocument}
                uploadedDocuments={state.uploadedDocuments}
                uploadingFiles={state.uploadingFiles}
              />

              <NewAccessionActions
                cancelLabel={t("form.cancel")}
                createLabel={t("form.createAccession")}
                creatingLabel={t("form.creating")}
                isSubmitting={state.isSubmitting}
                onCancel={back}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
