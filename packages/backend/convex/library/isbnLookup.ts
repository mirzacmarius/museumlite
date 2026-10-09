import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import {
  capabilityUnavailable,
  isOrganizationModuleEnabled,
} from "../utils/capabilities";

/**
 * ISBN lookup result type
 */
interface IsbnLookupResult {
  found: boolean;
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publicationYear?: number;
  publicationPlace?: string;
  pages?: number;
  description?: string;
  coverImageUrl?: string;
  isbn10?: string;
  isbn13?: string;
  subjects?: string[];
  language?: string;
  edition?: string;
  series?: string;
  deweyDecimal?: string;
  lcClassification?: string;
}

async function requireLibraryModule(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const isMember = await ctx.runQuery(
    internal.utils.permissions.checkOrgMembership,
    { userId, organizationId },
  );
  if (!isMember) {
    throw new Error("Not a member of this organization");
  }

  const org = await ctx.runQuery(api.organizations.get, { organizationId });
  if (!org) {
    throw new Error("Organization not found");
  }

  const access = {
    enabledModules: org.settings?.enabledModules,
    enabledIntegrations: org.settings?.enabledIntegrations,
  };
  if (!isOrganizationModuleEnabled(access, "library")) {
    throw capabilityUnavailable({
      reason: "module_disabled",
      capability: "library",
      module: "library",
      message: "Module not enabled: library",
    });
  }
}

/**
 * Look up book information by ISBN using Open Library API
 */
export const lookupIsbn = action({
  args: {
    organizationId: v.id("organizations"),
    isbn: v.string(),
  },
  returns: v.object({
    found: v.boolean(),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    authors: v.optional(v.array(v.string())),
    publisher: v.optional(v.string()),
    publicationYear: v.optional(v.number()),
    publicationPlace: v.optional(v.string()),
    pages: v.optional(v.number()),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    isbn10: v.optional(v.string()),
    isbn13: v.optional(v.string()),
    subjects: v.optional(v.array(v.string())),
    language: v.optional(v.string()),
    edition: v.optional(v.string()),
    series: v.optional(v.string()),
    deweyDecimal: v.optional(v.string()),
    lcClassification: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<IsbnLookupResult> => {
    await requireLibraryModule(ctx, args.organizationId);

    const cleanIsbn = args.isbn.replace(/[-\s]/g, "");

    // Validate ISBN format
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
      return { found: false };
    }

    try {
      // Try Open Library API first (Books API)
      const openLibraryResult = await lookupOpenLibrary(cleanIsbn);
      if (openLibraryResult.found) {
        return openLibraryResult;
      }

      // If not found, try the older bibkeys API
      const bibkeysResult = await lookupOpenLibraryBibkeys(cleanIsbn);
      if (bibkeysResult.found) {
        return bibkeysResult;
      }

      return { found: false };
    } catch (error) {
      console.error("ISBN lookup error:", error);
      return { found: false };
    }
  },
});

/**
 * Look up using Open Library Works API
 */
async function lookupOpenLibrary(isbn: string): Promise<IsbnLookupResult> {
  try {
    // First, get the book edition info
    const editionUrl = `https://openlibrary.org/isbn/${isbn}.json`;
    const editionResponse = await fetch(editionUrl);

    if (!editionResponse.ok) {
      return { found: false };
    }

    const editionData = await editionResponse.json();

    // Extract basic info from edition
    const result: IsbnLookupResult = {
      found: true,
      title: editionData.title,
      subtitle: editionData.subtitle,
      pages: editionData.number_of_pages,
      publisher: Array.isArray(editionData.publishers)
        ? editionData.publishers[0]
        : undefined,
      publicationPlace: Array.isArray(editionData.publish_places)
        ? editionData.publish_places[0]
        : undefined,
      publicationYear: editionData.publish_date
        ? extractYear(editionData.publish_date)
        : undefined,
      edition: editionData.edition_name,
      isbn10: Array.isArray(editionData.isbn_10)
        ? editionData.isbn_10[0]
        : undefined,
      isbn13: Array.isArray(editionData.isbn_13)
        ? editionData.isbn_13[0]
        : undefined,
      deweyDecimal: Array.isArray(editionData.dewey_decimal_class)
        ? editionData.dewey_decimal_class[0]
        : undefined,
      lcClassification: Array.isArray(editionData.lc_classifications)
        ? editionData.lc_classifications[0]
        : undefined,
    };

    // Get cover image URL
    if (editionData.covers && editionData.covers.length > 0) {
      result.coverImageUrl = `https://covers.openlibrary.org/b/id/${editionData.covers[0]}-L.jpg`;
    }

    // Try to get author info
    if (editionData.authors && editionData.authors.length > 0) {
      const authorNames = await Promise.all(
        editionData.authors.map(async (author: { key?: string }) => {
          if (author.key) {
            try {
              const authorResponse = await fetch(
                `https://openlibrary.org${author.key}.json`,
              );
              if (authorResponse.ok) {
                const authorData = await authorResponse.json();
                return authorData.name || authorData.personal_name;
              }
            } catch {
              // Ignore author fetch errors
            }
          }
          return null;
        }),
      );
      result.authors = authorNames.filter((name): name is string => !!name);
    }

    // Try to get work info for description and subjects
    if (editionData.works && editionData.works.length > 0) {
      const workKey = editionData.works[0].key;
      try {
        const workResponse = await fetch(
          `https://openlibrary.org${workKey}.json`,
        );
        if (workResponse.ok) {
          const workData = await workResponse.json();

          // Get description
          if (workData.description) {
            result.description =
              typeof workData.description === "string"
                ? workData.description
                : workData.description.value;
          }

          // Get subjects
          if (workData.subjects && workData.subjects.length > 0) {
            result.subjects = workData.subjects.slice(0, 10); // Limit to 10 subjects
          }

          // If we didn't get authors from edition, try from work
          if (!result.authors || result.authors.length === 0) {
            if (workData.authors && workData.authors.length > 0) {
              const authorNames = await Promise.all(
                workData.authors.map(
                  async (author: { author?: { key?: string } }) => {
                    const authorKey = author.author?.key;
                    if (authorKey) {
                      try {
                        const authorResponse = await fetch(
                          `https://openlibrary.org${authorKey}.json`,
                        );
                        if (authorResponse.ok) {
                          const authorData = await authorResponse.json();
                          return authorData.name || authorData.personal_name;
                        }
                      } catch {
                        // Ignore author fetch errors
                      }
                    }
                    return null;
                  },
                ),
              );
              result.authors = authorNames.filter(
                (name): name is string => !!name,
              );
            }
          }
        }
      } catch {
        // Ignore work fetch errors
      }
    }

    // Detect language from edition
    if (editionData.languages && editionData.languages.length > 0) {
      const langKey = editionData.languages[0].key;
      // Extract language code from key like "/languages/eng"
      const langCode = langKey.split("/").pop();
      result.language = mapLanguageCode(langCode);
    }

    return result;
  } catch (error) {
    console.error("Open Library lookup error:", error);
    return { found: false };
  }
}

/**
 * Fallback: Look up using Open Library bibkeys API
 */
type BibkeysBookData = {
  title?: string;
  subtitle?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  publish_places?: Array<{ name?: string }>;
  number_of_pages?: number;
  subjects?: Array<{ name?: string }>;
  cover?: { large?: string; medium?: string };
  identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
};

async function lookupOpenLibraryBibkeys(
  isbn: string,
): Promise<IsbnLookupResult> {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const response = await fetch(url);

    if (!response.ok) {
      return { found: false };
    }

    const data = (await response.json()) as Record<string, BibkeysBookData>;
    const bookData = data[`ISBN:${isbn}`];

    if (!bookData) {
      return { found: false };
    }

    const authorNames =
      bookData.authors?.flatMap((author: { name?: string }) =>
        author.name ? [author.name] : [],
      ) ?? [];

    const subjectNames =
      bookData.subjects
        ?.slice(0, 10)
        .flatMap((subject: { name?: string }) =>
          subject.name ? [subject.name] : [],
        ) ?? [];

    const result: IsbnLookupResult = {
      found: true,
      title: bookData.title,
      subtitle: bookData.subtitle,
      authors: authorNames,
      publisher: bookData.publishers?.[0]?.name,
      publicationYear: bookData.publish_date
        ? extractYear(bookData.publish_date)
        : undefined,
      publicationPlace: bookData.publish_places?.[0]?.name,
      pages: bookData.number_of_pages,
      subjects: subjectNames,
    };

    // Get cover
    if (bookData.cover) {
      result.coverImageUrl = bookData.cover.large || bookData.cover.medium;
    }

    // Get identifiers
    if (bookData.identifiers) {
      if (bookData.identifiers.isbn_10) {
        result.isbn10 = bookData.identifiers.isbn_10[0];
      }
      if (bookData.identifiers.isbn_13) {
        result.isbn13 = bookData.identifiers.isbn_13[0];
      }
    }

    return result;
  } catch (error) {
    console.error("Open Library bibkeys lookup error:", error);
    return { found: false };
  }
}

/**
 * Extract year from a date string
 */
function extractYear(dateStr: string): number | undefined {
  // Try to find a 4-digit year in the string
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  if (match) {
    return Number.parseInt(match[0], 10);
  }
  return undefined;
}

/**
 * Map Open Library language codes to full names
 */
function mapLanguageCode(code: string | undefined): string | undefined {
  if (!code) return undefined;

  const languageMap: Record<string, string> = {
    eng: "English",
    spa: "Spanish",
    fre: "French",
    ger: "German",
    ita: "Italian",
    por: "Portuguese",
    rus: "Russian",
    chi: "Chinese",
    jpn: "Japanese",
    ara: "Arabic",
    hin: "Hindi",
    kor: "Korean",
    dut: "Dutch",
    pol: "Polish",
    swe: "Swedish",
    nor: "Norwegian",
    dan: "Danish",
    fin: "Finnish",
    hun: "Hungarian",
    cze: "Czech",
    gre: "Greek",
    heb: "Hebrew",
    tur: "Turkish",
    vie: "Vietnamese",
    tha: "Thai",
    ind: "Indonesian",
    may: "Malay",
    lat: "Latin",
    und: "Unknown",
  };

  return languageMap[code.toLowerCase()] || code;
}

/**
 * Validate ISBN checksum
 */
export const validateIsbn = action({
  args: {
    organizationId: v.id("organizations"),
    isbn: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    type: v.optional(v.union(v.literal("isbn10"), v.literal("isbn13"))),
    normalized: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireLibraryModule(ctx, args.organizationId);

    const cleanIsbn = args.isbn.replace(/[-\s]/g, "");

    if (cleanIsbn.length === 10) {
      const valid = validateIsbn10(cleanIsbn);
      return {
        valid,
        type: valid ? ("isbn10" as const) : undefined,
        normalized: valid ? cleanIsbn : undefined,
      };
    }

    if (cleanIsbn.length === 13) {
      const valid = validateIsbn13(cleanIsbn);
      return {
        valid,
        type: valid ? ("isbn13" as const) : undefined,
        normalized: valid ? cleanIsbn : undefined,
      };
    }

    return { valid: false };
  },
});

/**
 * Validate ISBN-10 checksum
 */
function validateIsbn10(isbn: string): boolean {
  if (isbn.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const char = isbn.charAt(i);
    const digit = Number.parseInt(char, 10);
    if (Number.isNaN(digit)) return false;
    sum += digit * (10 - i);
  }

  const lastChar = isbn.charAt(9).toUpperCase();
  const lastDigit = lastChar === "X" ? 10 : Number.parseInt(lastChar, 10);
  if (Number.isNaN(lastDigit)) return false;

  sum += lastDigit;
  return sum % 11 === 0;
}

function validateIsbn13(isbn: string): boolean {
  if (isbn.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const char = isbn.charAt(i);
    const digit = Number.parseInt(char, 10);
    if (Number.isNaN(digit)) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  return sum % 10 === 0;
}

export const convertIsbn10To13 = action({
  args: {
    organizationId: v.id("organizations"),
    isbn10: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    isbn13: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireLibraryModule(ctx, args.organizationId);

    const cleanIsbn = args.isbn10.replace(/[-\s]/g, "");

    if (cleanIsbn.length !== 10) {
      return { success: false };
    }

    // Remove check digit and add 978 prefix
    const base = `978${cleanIsbn.slice(0, 9)}`;

    // Calculate ISBN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const char = base.charAt(i);
      const digit = Number.parseInt(char, 10);
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }

    const checkDigit = (10 - (sum % 10)) % 10;

    return {
      success: true,
      isbn13: `${base}${checkDigit}`,
    };
  },
});
