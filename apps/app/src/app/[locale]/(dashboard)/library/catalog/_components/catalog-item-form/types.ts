export const ITEM_TYPE_VALUES = [
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

export const TARGET_AUDIENCE_VALUES = [
  "children",
  "young_adult",
  "adult",
  "all_ages",
] as const;

export type ItemType = (typeof ITEM_TYPE_VALUES)[number];
export type TargetAudience = (typeof TARGET_AUDIENCE_VALUES)[number];

export interface CatalogItemFormData {
  itemType: ItemType;
  title: string;
  subtitle: string;
  authors: string[];
  isbn: string;
  isbn13: string;
  issn: string;
  barcode: string;
  callNumber: string;
  accessionNumber: string;
  publisher: string;
  publicationYear: string;
  publicationPlace: string;
  edition: string;
  language: string;
  originalLanguage: string;
  originalTitle: string;
  pages: string;
  duration: string;
  format: string;
  dimensions: string;
  deweyDecimal: string;
  lcClassification: string;
  categories: string;
  genres: string;
  subjects: string;
  keywords: string;
  targetAudience: TargetAudience | "";
  series: string;
  seriesNumber: string;
  description: string;
  tableOfContents: string;
  summary: string;
  coverImageUrl: string;
  isCirculating: boolean;
  loanPeriodDays: string;
  maxRenewals: string;
  notes: string;
  internalNotes: string;
}

export const EMPTY_CATALOG_ITEM_FORM: CatalogItemFormData = {
  itemType: "book",
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
  targetAudience: "",
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
};
