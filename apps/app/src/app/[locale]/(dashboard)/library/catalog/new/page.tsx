"use client";

import {
  IsbnLookup,
  type IsbnLookupData,
} from "@/components/library/isbn-lookup";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
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
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ITEM_TYPE_VALUES = [
  "book",
  "ebook",
  "audiobook",
  "periodical",
  "newspaper",
  "dvd",
  "cd",
  "map",
  "manuscript",
  "thesis",
  "other",
] as const;

const TARGET_AUDIENCE_VALUES = [
  "children",
  "young_adult",
  "adult",
  "all_ages",
] as const;

type ItemType = (typeof ITEM_TYPES)[number]["value"];
type TargetAudience = (typeof TARGET_AUDIENCES)[number]["value"];

export default function NewCatalogItemPage() {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const t = useScopedI18n("library.placeholders");
  const tNew = useScopedI18n("library.catalog.new");
  const tLib = useScopedI18n("library");

  const getItemTypeLabel = (value: string) => {
    return tLib(`itemTypes.${value}` as "itemTypes.book");
  };

  const getAudienceLabel = (value: string) => {
    const audienceMap: Record<string, string> = {
      children: "children",
      young_adult: "youngAdult",
      adult: "adult",
      all_ages: "allAges",
    };
    return tLib(
      `targetAudiences.${audienceMap[value] ?? value}` as "targetAudiences.children",
    );
  };
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLibraryEnabled = hasModule("library");

  const createItem = useMutation(api.library.items.create);

  // Form state
  const [formData, setFormData] = useState({
    itemType: "book" as ItemType,
    title: "",
    subtitle: "",
    authors: [""],
    isbn: "",
    isbn13: "",
    issn: "",
    barcode: "",
    callNumber: "",
    accessionNumber: "",
    publisher: "",
    publicationYear: "",
    publicationPlace: "",
    edition: "",
    language: "English",
    originalLanguage: "",
    originalTitle: "",
    pages: "",
    duration: "",
    format: "",
    dimensions: "",
    deweyDecimal: "",
    lcClassification: "",
    categories: "",
    genres: "",
    subjects: "",
    keywords: "",
    targetAudience: "" as TargetAudience | "",
    series: "",
    seriesNumber: "",
    description: "",
    tableOfContents: "",
    summary: "",
    coverImageUrl: "",
    isCirculating: true,
    loanPeriodDays: "",
    maxRenewals: "",
    notes: "",
    internalNotes: "",
  });

  const handleIsbnData = (data: IsbnLookupData) => {
    setFormData((prev) => ({
      ...prev,
      title: data.title || prev.title,
      subtitle: data.subtitle || prev.subtitle,
      authors: data.authors?.length ? data.authors : prev.authors,
      isbn: data.isbn10 || prev.isbn,
      isbn13: data.isbn13 || prev.isbn13,
      publisher: data.publisher || prev.publisher,
      publicationYear: data.publicationYear?.toString() || prev.publicationYear,
      publicationPlace: data.publicationPlace || prev.publicationPlace,
      edition: data.edition || prev.edition,
      language: data.language || prev.language,
      pages: data.pages?.toString() || prev.pages,
      deweyDecimal: data.deweyDecimal || prev.deweyDecimal,
      lcClassification: data.lcClassification || prev.lcClassification,
      subjects: data.subjects?.join(", ") || prev.subjects,
      series: data.series || prev.series,
      description: data.description || prev.description,
      coverImageUrl: data.coverImageUrl || prev.coverImageUrl,
    }));
  };

  const addAuthor = () => {
    setFormData((prev) => ({
      ...prev,
      authors: [...prev.authors, ""],
    }));
  };

  const removeAuthor = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      authors: prev.authors.filter((_, i) => i !== index),
    }));
  };

  const updateAuthor = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      authors: prev.authors.map((a, i) => (i === index ? value : a)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganizationId) return;

    setIsSaving(true);
    setError(null);

    try {
      const itemId = await createItem({
        organizationId: currentOrganizationId as Id<"organizations">,
        itemType: formData.itemType,
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        authors: formData.authors.filter((a) => a.trim()),
        isbn: formData.isbn || undefined,
        isbn13: formData.isbn13 || undefined,
        issn: formData.issn || undefined,
        barcode: formData.barcode || undefined,
        callNumber: formData.callNumber || undefined,
        accessionNumber: formData.accessionNumber || undefined,
        publisher: formData.publisher || undefined,
        publicationYear: formData.publicationYear
          ? Number.parseInt(formData.publicationYear, 10)
          : undefined,
        publicationPlace: formData.publicationPlace || undefined,
        edition: formData.edition || undefined,
        language: formData.language,
        originalLanguage: formData.originalLanguage || undefined,
        originalTitle: formData.originalTitle || undefined,
        pages: formData.pages ? Number.parseInt(formData.pages, 10) : undefined,
        duration: formData.duration
          ? Number.parseInt(formData.duration, 10)
          : undefined,
        format: formData.format || undefined,
        dimensions: formData.dimensions || undefined,
        deweyDecimal: formData.deweyDecimal || undefined,
        lcClassification: formData.lcClassification || undefined,
        categories: formData.categories
          ? formData.categories.split(",").map((c) => c.trim())
          : undefined,
        genres: formData.genres
          ? formData.genres.split(",").map((g) => g.trim())
          : undefined,
        subjects: formData.subjects
          ? formData.subjects.split(",").map((s) => s.trim())
          : undefined,
        keywords: formData.keywords
          ? formData.keywords.split(",").map((k) => k.trim())
          : undefined,
        targetAudience: formData.targetAudience || undefined,
        series: formData.series || undefined,
        seriesNumber: formData.seriesNumber
          ? Number.parseInt(formData.seriesNumber, 10)
          : undefined,
        description: formData.description || undefined,
        tableOfContents: formData.tableOfContents || undefined,
        summary: formData.summary || undefined,
        coverImageUrl: formData.coverImageUrl || undefined,
        isCirculating: formData.isCirculating,
        loanPeriodDays: formData.loanPeriodDays
          ? Number.parseInt(formData.loanPeriodDays, 10)
          : undefined,
        maxRenewals: formData.maxRenewals
          ? Number.parseInt(formData.maxRenewals, 10)
          : undefined,
        notes: formData.notes || undefined,
        internalNotes: formData.internalNotes || undefined,
      });

      router.push(`/library/catalog/${itemId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tNew("createFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tNew("selectOrganization")}</p>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{tNew("notEnabled")}</p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/library/catalog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tNew("back")}
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-medium">{tNew("pageTitle")}</h1>
              <p className="text-sm text-muted-foreground">
                {tNew("pageDescription")}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ISBN Lookup */}
          <IsbnLookup
            onDataFound={handleIsbnData}
            onIsbnChange={(isbn) => {
              const cleanIsbn = isbn.replace(/[-\s]/g, "");
              if (cleanIsbn.length === 10) {
                setFormData((prev) => ({ ...prev, isbn: cleanIsbn }));
              } else if (cleanIsbn.length === 13) {
                setFormData((prev) => ({ ...prev, isbn13: cleanIsbn }));
              }
            }}
          />

          {/* Basic Information */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{tNew("basicInfo")}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="itemType">{tNew("itemType")}</Label>
                <Select
                  value={formData.itemType}
                  onValueChange={(value: ItemType) =>
                    setFormData((prev) => ({ ...prev, itemType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {getItemTypeLabel(formData.itemType)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {getItemTypeLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">{tNew("language")}</Label>
                <Input
                  id="language"
                  value={formData.language}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  placeholder={t("english")}
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">{tNew("titleLabel")}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder={t("enterTitle")}
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subtitle">{tNew("subtitle")}</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subtitle: e.target.value,
                    }))
                  }
                  placeholder={t("enterSubtitle")}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{tNew("authors")}</Label>
                {formData.authors.map((author, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Index needed for editable form array
                  <div key={index} className="flex gap-2">
                    <Input
                      value={author}
                      onChange={(e) => updateAuthor(index, e.target.value)}
                      placeholder={tNew("authorPlaceholder", {
                        number: index + 1,
                      })}
                    />
                    {formData.authors.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeAuthor(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAuthor}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tNew("addAuthor")}
                </Button>
              </div>
            </div>
          </div>

          {/* Identifiers */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{tNew("identifiers")}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="isbn">{tNew("isbn10")}</Label>
                <Input
                  id="isbn"
                  value={formData.isbn}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isbn: e.target.value }))
                  }
                  placeholder="0-123456-78-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isbn13">{tNew("isbn13")}</Label>
                <Input
                  id="isbn13"
                  value={formData.isbn13}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isbn13: e.target.value }))
                  }
                  placeholder="978-0-123456-78-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issn">{tNew("issn")}</Label>
                <Input
                  id="issn"
                  value={formData.issn}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, issn: e.target.value }))
                  }
                  placeholder={t("forPeriodicals")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">{tNew("barcode")}</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      barcode: e.target.value,
                    }))
                  }
                  placeholder={t("itemBarcode")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="callNumber">{tNew("callNumber")}</Label>
                <Input
                  id="callNumber"
                  value={formData.callNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      callNumber: e.target.value,
                    }))
                  }
                  placeholder="e.g., 823.912"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessionNumber">
                  {tNew("accessionNumber")}
                </Label>
                <Input
                  id="accessionNumber"
                  value={formData.accessionNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      accessionNumber: e.target.value,
                    }))
                  }
                  placeholder={t("libraryAccessionNumber")}
                />
              </div>
            </div>
          </div>

          {/* Publication Details */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">
                {tNew("publicationDetails")}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="publisher">{tNew("publisher")}</Label>
                <Input
                  id="publisher"
                  value={formData.publisher}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      publisher: e.target.value,
                    }))
                  }
                  placeholder={t("publisherName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publicationYear">
                  {tNew("publicationYear")}
                </Label>
                <Input
                  id="publicationYear"
                  type="number"
                  value={formData.publicationYear}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      publicationYear: e.target.value,
                    }))
                  }
                  placeholder="e.g., 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publicationPlace">
                  {tNew("publicationPlace")}
                </Label>
                <Input
                  id="publicationPlace"
                  value={formData.publicationPlace}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      publicationPlace: e.target.value,
                    }))
                  }
                  placeholder="e.g., New York"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edition">{tNew("edition")}</Label>
                <Input
                  id="edition"
                  value={formData.edition}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      edition: e.target.value,
                    }))
                  }
                  placeholder="e.g., 2nd Edition"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">{tNew("pages")}</Label>
                <Input
                  id="pages"
                  type="number"
                  value={formData.pages}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pages: e.target.value }))
                  }
                  placeholder={t("numberOfPages")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">{tNew("format")}</Label>
                <Input
                  id="format"
                  value={formData.format}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, format: e.target.value }))
                  }
                  placeholder="e.g., Hardcover, Paperback"
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{tNew("classification")}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deweyDecimal">{tNew("deweyDecimal")}</Label>
                <Input
                  id="deweyDecimal"
                  value={formData.deweyDecimal}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deweyDecimal: e.target.value,
                    }))
                  }
                  placeholder="e.g., 823.912"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcClassification">
                  {tNew("lcClassification")}
                </Label>
                <Input
                  id="lcClassification"
                  value={formData.lcClassification}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lcClassification: e.target.value,
                    }))
                  }
                  placeholder="e.g., PR6019.O9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categories">{tNew("categories")}</Label>
                <Input
                  id="categories"
                  value={formData.categories}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      categories: e.target.value,
                    }))
                  }
                  placeholder={t("commaSeparatedCategories")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genres">{tNew("genres")}</Label>
                <Input
                  id="genres"
                  value={formData.genres}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, genres: e.target.value }))
                  }
                  placeholder={t("commaSeparatedGenres")}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subjects">{tNew("subjects")}</Label>
                <Input
                  id="subjects"
                  value={formData.subjects}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subjects: e.target.value,
                    }))
                  }
                  placeholder={t("commaSeparatedSubjects")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAudience">{tNew("targetAudience")}</Label>
                <Select
                  value={formData.targetAudience}
                  onValueChange={(value: TargetAudience) =>
                    setFormData((prev) => ({ ...prev, targetAudience: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectAudience")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_AUDIENCE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {getAudienceLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="series">{tNew("series")}</Label>
                <Input
                  id="series"
                  value={formData.series}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, series: e.target.value }))
                  }
                  placeholder={t("seriesName")}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">
                {tNew("descriptionLabel")}
              </h2>
            </div>
            <div className="space-y-6 p-6">
              <div className="space-y-2">
                <Label htmlFor="description">{tNew("descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t("bookDescription")}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverImageUrl">{tNew("coverImageUrl")}</Label>
                <Input
                  id="coverImageUrl"
                  value={formData.coverImageUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      coverImageUrl: e.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
                {formData.coverImageUrl && (
                  <div className="mt-2">
                    <img
                      src={formData.coverImageUrl}
                      alt="Cover preview"
                      className="h-40 w-auto rounded border object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{tNew("notes")}</h2>
            </div>
            <div className="space-y-6 p-6">
              <div className="space-y-2">
                <Label htmlFor="notes">{tNew("publicNotes")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder={t("notesVisibleToPatrons")}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internalNotes">{tNew("internalNotes")}</Label>
                <Textarea
                  id="internalNotes"
                  value={formData.internalNotes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      internalNotes: e.target.value,
                    }))
                  }
                  placeholder={t("staffOnlyNotes")}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/library/catalog">{tNew("cancel")}</Link>
            </Button>
            <Button type="submit" disabled={isSaving || !formData.title.trim()}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tNew("saveAsDraft")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
