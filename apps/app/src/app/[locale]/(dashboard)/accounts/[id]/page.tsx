"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { Textarea } from "@v1/ui/textarea";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Building2,
  Download,
  Edit,
  FileText,
  History,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Plus,
  Shield,
  Trash2,
  Upload,
  User,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function AccountDetailPage() {
  const locale = useCurrentLocale();
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const tToast = useScopedI18n("accounts.detail.toasts");
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as Id<"accounts">;
  const { currentOrganizationId } = useOrganization();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const account = useQuery(api.accounts.get, { accountId }) as
    | Account
    | null
    | undefined;
  const contacts = useQuery(api.contacts.list, { accountId }) as
    | Contact[]
    | undefined;
  const documents = useQuery(api.accountDocuments.list, { accountId }) as
    | AccountDocument[]
    | undefined;
  const relationships = useQuery(api.accountRelationships.list, {
    accountId,
  }) as Relationship[] | undefined;
  const timelineResult = useQuery(api.accountRelationships.timeline, {
    accountId,
    limit: 50,
  });
  const timeline = timelineResult?.events;

  const deleteAccount = useMutation(api.accounts.remove);
  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationTitle")}</p>
      </div>
    );
  }

  if (account === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (account === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("accountNotFound")}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount({ accountId });
      router.push("/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts">
                <ArrowLeft className="mr-2 size-4" />
                {t("back")}
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-medium">
                  {account.businessName ||
                    `${account.firstName} ${account.lastName}`}
                </h1>
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                Account: {account.accountNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <PermissionGate permission="accounts.write">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/accounts/${accountId}/edit`}>
                  <Edit className="mr-2 size-4" />
                  {tCommon("edit")}
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate permission="accounts.delete">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 size-4" />
                    {tCommon("delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("detail.deleteAccount")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("detail.deleteConfirm")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      {tCommon("cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting
                        ? tCommon("loading")
                        : t("detail.deleteAccount")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">{t("detail.overview")}</TabsTrigger>
            <TabsTrigger value="contacts">
              {t("detail.contacts")}
              {contacts && contacts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {contacts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents">
              {t("detail.documents")}
              {documents && documents.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {documents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="relationships">
              {t("detail.relationships")}
              {relationships && relationships.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {relationships.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">{t("detail.activity")}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <OverviewTab account={account} />
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-6">
            <ContactsTab accountId={accountId} contacts={contacts} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <DocumentsTab accountId={accountId} documents={documents} />
          </TabsContent>

          {/* Relationships Tab */}
          <TabsContent value="relationships" className="space-y-6">
            <RelationshipsTab
              accountId={accountId}
              relationships={relationships}
            />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivityTab timeline={timeline} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type Account = {
  _id: Id<"accounts">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  accountNumber: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
};

type Contact = {
  _id: Id<"contacts">;
  _creationTime: number;
  accountId: Id<"accounts">;
  firstName: string;
  lastName: string;
  title?: string;
  role: "primary" | "billing" | "shipping" | "technical";
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
};

type AccountDocument = {
  _id: Id<"accountDocuments">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  accountId: Id<"accounts">;
  storageId: Id<"_storage">;
  filename: string;
  mimeType: string;
  size: number;
  documentType:
    | "contract"
    | "agreement"
    | "invoice"
    | "correspondence"
    | "other";
  description?: string;
  uploadedBy: Id<"users">;
  uploadedAt: number;
};

type Relationship = {
  _id: Id<"accountRelationships">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  accountId: Id<"accounts">;
  relatedEntityType: "loan" | "exhibition" | "item";
  relatedEntityId: Id<"loans"> | Id<"exhibitions"> | Id<"collections">;
  relationshipType: string;
  startDate: number;
  endDate?: number;
  notes?: string;
};

type TimelineEvent = {
  type: "relationship" | "document" | "note";
  timestamp: number;
  description: string;
  metadata?: unknown;
};

function OverviewTab({ account }: { account: Account }) {
  const t = useScopedI18n("accounts");
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-6 text-lg font-medium">
        {t("detail.accountInformation")}
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Business Information */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              {t("form.businessInformation")}
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{account.businessName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("detail.businessName")}
                  </p>
                </div>
              </div>
              {account.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{account.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.phone")}
                    </p>
                  </div>
                </div>
              )}
              {account.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">{account.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.email")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        {(account.address ||
          account.city ||
          account.zipCode ||
          account.country) && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                {t("detail.address")}
              </h3>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                <div className="space-y-1">
                  {account.address && (
                    <p className="text-sm">{account.address}</p>
                  )}
                  {(account.city || account.zipCode) && (
                    <p className="text-sm">
                      {[account.city, account.zipCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {account.country && (
                    <p className="text-sm">{account.country}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {account.notes && (
          <div className="space-y-4 md:col-span-2">
            <div>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                {t("detail.notes")}
              </h3>
              <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Contacts Tab Component
function ContactsTab({
  accountId,
  contacts,
}: {
  accountId: Id<"accounts">;
  contacts: Contact[] | undefined;
}) {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const tToast = useScopedI18n("accounts.detail.toasts");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const deleteContact = useMutation(api.contacts.remove);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium">{t("detail.contacts")}</h2>
        <PermissionGate permission="accounts.write">
          <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 size-4" />
                {t("detail.addContact")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("detail.addContact")}</DialogTitle>
                <DialogDescription>
                  {t("detail.addContactDescription")}
                </DialogDescription>
              </DialogHeader>
              <ContactForm
                accountId={accountId}
                onSuccess={() => setIsAddingContact(false)}
              />
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {!contacts || contacts.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("detail.noContacts")}
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact._id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <User className="size-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </p>
                    {contact.isPrimary && (
                      <Badge variant="default" className="text-xs">
                        {t("detail.primary")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                    {contact.title && <span>{contact.title}</span>}
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                  </div>
                </div>
              </div>
              <PermissionGate permission="accounts.write">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingContact(contact)}
                  >
                    <Edit className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("detail.deleteContact")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("detail.deleteContactConfirm", {
                            name: `${contact.firstName} ${contact.lastName}`,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await deleteContact({ contactId: contact._id });
                              toast.success(tToast("contactDeleted"));
                            } catch (error) {
                              toast.error(tToast("contactDeleteFailed"));
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {tCommon("delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}

      {/* Edit Contact Dialog */}
      {editingContact && (
        <Dialog
          open={!!editingContact}
          onOpenChange={() => setEditingContact(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("detail.editContact")}</DialogTitle>
              <DialogDescription>
                {t("detail.editContactDescription")}
              </DialogDescription>
            </DialogHeader>
            <ContactForm
              accountId={accountId}
              contact={editingContact}
              onSuccess={() => setEditingContact(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Contact Form Component
function ContactForm({
  accountId,
  contact,
  onSuccess,
}: {
  accountId: Id<"accounts">;
  contact?: Contact;
  onSuccess: () => void;
}) {
  const t = useScopedI18n("accounts.detail");
  const tForm = useScopedI18n("accounts.form");
  const tToast = useScopedI18n("accounts.detail.toasts");
  const createContact = useMutation(api.contacts.create);
  const updateContact = useMutation(api.contacts.update);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    try {
      const contactData = {
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        title: (formData.get("title") as string) || undefined,
        role:
          (formData.get("role") as
            | "primary"
            | "billing"
            | "shipping"
            | "technical") || "primary",
        email: (formData.get("email") as string) || undefined,
        phone: (formData.get("phone") as string) || undefined,
        mobile: undefined,
        preferredContact: "email" as const,
        isPrimary: formData.get("isPrimary") === "on",
        isActive: true,
        notes: undefined,
      };

      if (contact) {
        await updateContact({
          contactId: contact._id,
          ...contactData,
        });
        toast.success(tToast("contactUpdated"));
      } else {
        await createContact({
          accountId,
          ...contactData,
        });
        toast.success(tToast("contactAdded"));
      }
      onSuccess();
    } catch (error) {
      toast.error(
        contact ? tToast("contactUpdateFailed") : tToast("contactAddFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t("firstName")}</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={contact?.firstName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t("lastName")}</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={contact?.lastName}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">{t("title")}</Label>
        <Input
          id="title"
          name="title"
          defaultValue={contact?.title}
          placeholder={tForm("placeholders.title")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{tForm("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={contact?.email}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{tForm("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={contact?.phone}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">{t("roles.label")}</Label>
        <Select name="role" defaultValue={contact?.role || "primary"}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">{t("roles.primary")}</SelectItem>
            <SelectItem value="billing">{t("roles.billing")}</SelectItem>
            <SelectItem value="shipping">{t("roles.shipping")}</SelectItem>
            <SelectItem value="technical">{t("roles.technical")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isPrimary"
          name="isPrimary"
          defaultChecked={contact?.isPrimary}
          className="size-4"
        />
        <Label htmlFor="isPrimary" className="text-sm font-normal">
          {t("setPrimaryContact")}
        </Label>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? contact
              ? t("updating")
              : t("adding")
            : contact
              ? t("updateContact")
              : t("addContact")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DownloadDocumentButton({
  documentId,
}: { documentId: Id<"accountDocuments"> }) {
  const documentWithUrl = useQuery(api.accountDocuments.get, { documentId });

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (documentWithUrl?.downloadUrl) {
          window.open(documentWithUrl.downloadUrl, "_blank");
        }
      }}
      disabled={!documentWithUrl?.downloadUrl}
    >
      <Download className="size-4" />
    </Button>
  );
}

function DocumentsTab({
  accountId,
  documents,
}: {
  accountId: Id<"accounts">;
  documents: AccountDocument[] | undefined;
}) {
  const t = useScopedI18n("accounts.detail");
  const tCommon = useScopedI18n("common");
  const tToast = useScopedI18n("accounts.detail.toasts");
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<
    "contract" | "agreement" | "invoice" | "correspondence" | "other"
  >("other");
  const [description, setDescription] = useState("");

  const generateUploadUrl = useAction(api.accountDocuments.generateUploadUrl);
  const createDocument = useMutation(api.accountDocuments.create);
  const deleteDocument = useMutation(api.accountDocuments.remove);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadDialog(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!uploadResult.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await uploadResult.json();

      await createDocument({
        accountId,
        storageId,
        filename: selectedFile.name,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        documentType,
        description: description || undefined,
      });

      toast.success(tToast("documentUploaded"));
      setShowUploadDialog(false);
      setSelectedFile(null);
      setDescription("");
      setDocumentType("other");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error(tToast("documentUploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium">{t("documents")}</h2>
        <PermissionGate permission="accounts.write">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mr-2 size-4" />
              {t("uploadDocument")}
            </Button>
          </div>
        </PermissionGate>
      </div>

      {!documents || documents.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("noDocuments")}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{doc.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.documentType} • {(doc.size / 1024).toFixed(1)} KB
                    {doc.description && ` • ${doc.description}`}
                  </p>
                </div>
              </div>
              <PermissionGate permission="accounts.write">
                <div className="flex gap-2">
                  <DownloadDocumentButton documentId={doc._id} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("deleteDocument")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("deleteDocumentConfirm", { name: doc.filename })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await deleteDocument({ documentId: doc._id });
                              toast.success(tToast("documentDeleted"));
                            } catch (error) {
                              toast.error(tToast("documentDeleteFailed"));
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {tCommon("delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("uploadDocument")}</DialogTitle>
            <DialogDescription>{t("addDocumentDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("file")}</Label>
              <p className="text-sm text-muted-foreground">
                {selectedFile?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentType">{t("documentType")}</Label>
              <Select
                value={documentType}
                onValueChange={(value) =>
                  setDocumentType(value as typeof documentType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">
                    {t("documentTypes.contract")}
                  </SelectItem>
                  <SelectItem value="agreement">
                    {t("documentTypes.agreement")}
                  </SelectItem>
                  <SelectItem value="invoice">
                    {t("documentTypes.invoice")}
                  </SelectItem>
                  <SelectItem value="correspondence">
                    {t("documentTypes.correspondence")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("documentTypes.other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionOptional")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionOptional")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                setSelectedFile(null);
                setDescription("");
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? t("uploading") : t("upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Relationships Tab Component
function RelationshipsTab({
  accountId,
  relationships,
}: {
  accountId: Id<"accounts">;
  relationships: Relationship[] | undefined;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("accounts.detail");
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium">{t("relationships")}</h2>
        <PermissionGate permission="accounts.write">
          <Button size="sm">
            <LinkIcon className="mr-2 size-4" />
            {t("linkEntity")}
          </Button>
        </PermissionGate>
      </div>

      {!relationships || relationships.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("noRelationships")}
        </div>
      ) : (
        <div className="space-y-3">
          {relationships.map((rel) => (
            <div
              key={rel._id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{rel.relatedEntityType}</Badge>
                  <p className="font-medium">{rel.relationshipType}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(new Date(rel.startDate), locale)}
                  {rel.endDate &&
                    ` - ${formatDate(new Date(rel.endDate), locale)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ timeline }: { timeline: TimelineEvent[] | undefined }) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("accounts.detail");
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-6 text-lg font-medium">{t("activityTimeline")}</h2>

      {!timeline || timeline.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t("noActivity")}
        </div>
      ) : (
        <div className="space-y-4">
          {timeline.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                  <History className="size-4 text-primary" />
                </div>
                {index < timeline.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>
              <div className="flex-1 pb-8">
                <p className="font-medium">{event.type}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(new Date(event.timestamp), locale)}
                </p>
                {event.description && (
                  <p className="mt-1 text-sm">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
