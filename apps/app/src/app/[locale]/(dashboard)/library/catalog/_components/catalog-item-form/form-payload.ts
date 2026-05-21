import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { CatalogItemFormData } from "./types";

function catalogItemFormFields(formData: CatalogItemFormData) {
  return {
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
  };
}

export function catalogItemFormToCreatePayload(
  organizationId: Id<"organizations">,
  formData: CatalogItemFormData,
) {
  return {
    organizationId,
    ...catalogItemFormFields(formData),
  };
}

export function catalogItemFormToUpdatePayload(
  itemId: Id<"libraryItems">,
  formData: CatalogItemFormData,
) {
  return { itemId, ...catalogItemFormFields(formData) };
}

interface LibraryItemDoc {
  itemType: CatalogItemFormData["itemType"];
  title: string;
  subtitle?: string;
  authors: string[];
  isbn?: string;
  isbn13?: string;
  issn?: string;
  barcode?: string;
  callNumber?: string;
  accessionNumber?: string;
  publisher?: string;
  publicationYear?: number;
  publicationPlace?: string;
  edition?: string;
  language: string;
  originalLanguage?: string;
  originalTitle?: string;
  pages?: number;
  duration?: number;
  format?: string;
  dimensions?: string;
  deweyDecimal?: string;
  lcClassification?: string;
  categories?: string[];
  genres?: string[];
  subjects?: string[];
  keywords?: string[];
  targetAudience?: CatalogItemFormData["targetAudience"];
  series?: string;
  seriesNumber?: number;
  description?: string;
  tableOfContents?: string;
  summary?: string;
  coverImageUrl?: string;
  isCirculating?: boolean;
  loanPeriodDays?: number;
  maxRenewals?: number;
  notes?: string;
  internalNotes?: string;
}

export function libraryItemToFormData(
  item: LibraryItemDoc,
): CatalogItemFormData {
  return {
    itemType: item.itemType,
    title: item.title,
    subtitle: item.subtitle || "",
    authors: item.authors.length > 0 ? item.authors : [""],
    isbn: item.isbn || "",
    isbn13: item.isbn13 || "",
    issn: item.issn || "",
    barcode: item.barcode || "",
    callNumber: item.callNumber || "",
    accessionNumber: item.accessionNumber || "",
    publisher: item.publisher || "",
    publicationYear: item.publicationYear?.toString() || "",
    publicationPlace: item.publicationPlace || "",
    edition: item.edition || "",
    language: item.language,
    originalLanguage: item.originalLanguage || "",
    originalTitle: item.originalTitle || "",
    pages: item.pages?.toString() || "",
    duration: item.duration?.toString() || "",
    format: item.format || "",
    dimensions: item.dimensions || "",
    deweyDecimal: item.deweyDecimal || "",
    lcClassification: item.lcClassification || "",
    categories: item.categories?.join(", ") || "",
    genres: item.genres?.join(", ") || "",
    subjects: item.subjects?.join(", ") || "",
    keywords: item.keywords?.join(", ") || "",
    targetAudience: item.targetAudience || "",
    series: item.series || "",
    seriesNumber: item.seriesNumber?.toString() || "",
    description: item.description || "",
    tableOfContents: item.tableOfContents || "",
    summary: item.summary || "",
    coverImageUrl: item.coverImageUrl || "",
    isCirculating: item.isCirculating ?? true,
    loanPeriodDays: item.loanPeriodDays?.toString() || "",
    maxRenewals: item.maxRenewals?.toString() || "",
    notes: item.notes || "",
    internalNotes: item.internalNotes || "",
  };
}
