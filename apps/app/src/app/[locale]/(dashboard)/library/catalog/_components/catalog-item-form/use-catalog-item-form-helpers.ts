import type { IsbnLookupData } from "@/components/library/isbn-lookup";
import { useScopedI18n } from "@/locales/client";
import type { CatalogItemFormData } from "./types";

export function useCatalogItemFormLabels() {
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

  return { getItemTypeLabel, getAudienceLabel };
}

export function applyIsbnLookupToForm(
  data: IsbnLookupData,
  prev: CatalogItemFormData,
): CatalogItemFormData {
  return {
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
  };
}

export function useCatalogItemAuthorFields(
  setFormData: React.Dispatch<React.SetStateAction<CatalogItemFormData>>,
) {
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

  return { addAuthor, removeAuthor, updateAuthor };
}
