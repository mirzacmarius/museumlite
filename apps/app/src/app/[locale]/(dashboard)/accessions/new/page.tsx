"use client";

import { AccountCombobox } from "@/components/account-combobox";
import {
  DropzoneUploader,
  type UploadFile,
} from "@/components/dropzone-uploader";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { useCallback, useState } from "react";

export default function NewAccessionPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createAccession = useMutation(api.accessions.create);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<
    { storageId: Id<"_storage">; name: string }[]
  >([]);
  const [formData, setFormData] = useState({
    accessionNumber: "",
    dateReceived: new Date(),
    source: "",
    donorAccountId: undefined as string | undefined,
    method: "purchase" as
      | "purchase"
      | "gift"
      | "loan"
      | "transfer"
      | "donation"
      | "other"
      | "bequest",
    cost: "",
    notes: "",
  });

  const handleDocumentUpload = useCallback(
    async (files: File[]) => {
      const newUploads: UploadFile[] = files.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: "pending" as const,
      }));

      setUploadingFiles((prev) => [...prev, ...newUploads]);

      for (const upload of newUploads) {
        try {
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === upload.id ? { ...u, status: "uploading" } : u,
            ),
          );

          const uploadUrl = await generateUploadUrl({});

          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": upload.file.type },
            body: upload.file,
          });

          if (!response.ok) {
            throw new Error("Upload failed");
          }

          const { storageId } = await response.json();

          setUploadedDocuments((prev) => [
            ...prev,
            { storageId: storageId as Id<"_storage">, name: upload.file.name },
          ]);

          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? { ...u, status: "complete", progress: 100 }
                : u,
            ),
          );
        } catch (err) {
          console.error("Upload error:", err);
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? { ...u, status: "error", error: "Upload failed" }
                : u,
            ),
          );
        }
      }

      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((u) => u.status !== "complete"),
        );
      }, 2000);
    },
    [generateUploadUrl],
  );

  const handleRemoveDocument = useCallback((storageId: Id<"_storage">) => {
    setUploadedDocuments((prev) =>
      prev.filter((doc) => doc.storageId !== storageId),
    );
  }, []);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create accessions.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.source.trim() && !formData.donorAccountId) {
      setError("Either Source or Donor/Source Account is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAccession({
        organizationId: currentOrganizationId as Id<"organizations">,
        accessionNumber: formData.accessionNumber || undefined,
        dateReceived: formData.dateReceived.getTime(),
        source: formData.source || "See linked account",
        donorAccountId: formData.donorAccountId
          ? (formData.donorAccountId as Id<"accounts">)
          : undefined,
        documents:
          uploadedDocuments.length > 0
            ? uploadedDocuments.map((d) => d.storageId)
            : undefined,
        method: formData.method,
        cost: formData.cost ? Number.parseFloat(formData.cost) : undefined,
        notes: formData.notes || undefined,
      });
      router.push("/accessions");
    } catch (err) {
      console.error("Error creating accession:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create accession. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accessions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accessions
              </Link>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accessionNumber">Accession Number</Label>
                <Input
                  id="accessionNumber"
                  value={formData.accessionNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accessionNumber: e.target.value,
                    })
                  }
                  placeholder="Auto-generated if left empty"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate based on organization format
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateReceived">Date Received *</Label>
                  <DatePicker
                    id="dateReceived"
                    date={formData.dateReceived}
                    onSelect={(date: Date | undefined) =>
                      setFormData({
                        ...formData,
                        dateReceived: date || new Date(),
                      })
                    }
                    placeholder="Select date received"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Method *</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(
                      value:
                        | "purchase"
                        | "gift"
                        | "loan"
                        | "transfer"
                        | "donation"
                        | "other"
                        | "bequest",
                    ) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger id="method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="gift">Gift</SelectItem>
                      <SelectItem value="loan">Loan</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="donorAccount">Donor / Source Account</Label>
                <AccountCombobox
                  organizationId={currentOrganizationId}
                  value={formData.donorAccountId}
                  onValueChange={(accountId) =>
                    setFormData({ ...formData, donorAccountId: accountId })
                  }
                  placeholder="Select or create donor account..."
                />
                <p className="text-xs text-muted-foreground">
                  Link to an existing account or create a new one
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">
                  Source {!formData.donorAccountId && "*"}
                </Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                  placeholder="e.g., Private collector, Auction house"
                  required={!formData.donorAccountId}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.donorAccountId
                    ? "Optional if donor account is selected"
                    : "Required if no donor account selected"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes about this accession..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Supporting Documents</Label>
                <DropzoneUploader
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  maxSizeBytes={20 * 1024 * 1024}
                  maxFiles={10}
                  onFilesSelected={handleDocumentUpload}
                  uploadingFiles={uploadingFiles}
                  label="Drop documents here or click to upload"
                  sublabel="PDF, Word, or images up to 20MB each"
                />
                {uploadedDocuments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadedDocuments.map((doc) => (
                      <div
                        key={doc.storageId}
                        className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="truncate">{doc.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDocument(doc.storageId)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <PermissionGate permission="collections.create">
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating..." : "Create Accession"}
                  </Button>
                </PermissionGate>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
