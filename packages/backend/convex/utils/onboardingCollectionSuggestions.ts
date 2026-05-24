export type OrganizationType = "museum" | "gallery" | "library" | "collector";

export interface SuggestedCollectionGroup {
  name: string;
  description: string;
}

export interface CollectionSetupSuggestion {
  summary: string;
  collectionGroups: SuggestedCollectionGroup[];
  objectTypes: string[];
  source: "ai" | "template";
}

const TEMPLATE_BY_TYPE: Record<
  OrganizationType,
  { summary: string; collectionGroups: SuggestedCollectionGroup[]; objectTypes: string[] }
> = {
  museum: {
    summary:
      "A museum typically organizes holdings by curatorial department and material type.",
    collectionGroups: [
      {
        name: "Fine Art",
        description: "Paintings, works on paper, and contemporary art holdings.",
      },
      {
        name: "Decorative Arts",
        description: "Furniture, ceramics, metalwork, and design objects.",
      },
      {
        name: "Archives & Library",
        description: "Manuscripts, photographs, and reference collections.",
      },
    ],
    objectTypes: ["Painting", "Sculpture", "Photograph", "Textile", "Ceramic"],
  },
  gallery: {
    summary:
      "A gallery often tracks inventory by exhibition, artist representation, and medium.",
    collectionGroups: [
      {
        name: "Current Inventory",
        description: "Works available for sale or exhibition.",
      },
      {
        name: "Consignment",
        description: "Objects held on behalf of artists or estates.",
      },
      {
        name: "Past Exhibitions",
        description: "Works shown in previous gallery programs.",
      },
    ],
    objectTypes: ["Painting", "Print", "Photograph", "Mixed Media", "Installation"],
  },
  library: {
    summary:
      "A library collection is usually grouped by format, subject, and special collections.",
    collectionGroups: [
      {
        name: "General Collection",
        description: "Circulating monographs and serials.",
      },
      {
        name: "Special Collections",
        description: "Rare books, archives, and local history materials.",
      },
      {
        name: "Media",
        description: "Audiovisual, digital, and multimedia holdings.",
      },
    ],
    objectTypes: ["Book", "Manuscript", "Map", "Periodical", "Audiovisual"],
  },
  collector: {
    summary:
      "Private collectors often group objects by passion area, provenance, or location.",
    collectionGroups: [
      {
        name: "Core Collection",
        description: "Primary objects you actively catalog and display.",
      },
      {
        name: "Acquisitions In Progress",
        description: "Objects being researched or awaiting documentation.",
      },
      {
        name: "Storage",
        description: "Works kept off display but maintained in inventory.",
      },
    ],
    objectTypes: ["Painting", "Print", "Object", "Book", "Memorabilia"],
  },
};

function trimDescription(description: string, maxLength = 280): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function personalizeSummary(
  baseSummary: string,
  organizationName: string,
  description: string,
): string {
  const detail = description.trim();
  if (!detail) {
    return `${baseSummary} Tailored starting points for ${organizationName}.`;
  }
  return `${baseSummary} Based on your note: ${trimDescription(detail, 160)}`;
}

export function buildTemplateCollectionSuggestions(args: {
  organizationName: string;
  organizationType: OrganizationType;
  description: string;
}): CollectionSetupSuggestion {
  const template = TEMPLATE_BY_TYPE[args.organizationType];
  return {
    summary: personalizeSummary(
      template.summary,
      args.organizationName,
      args.description,
    ),
    collectionGroups: template.collectionGroups.map((group) => ({
      name: group.name,
      description: group.description,
    })),
    objectTypes: [...template.objectTypes],
    source: "template",
  };
}

export function parseCollectionSetupSuggestionJson(
  raw: string,
): CollectionSetupSuggestion | null {
  try {
    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      collectionGroups?: unknown;
      objectTypes?: unknown;
    };

    if (typeof parsed.summary !== "string") return null;
    if (!Array.isArray(parsed.collectionGroups)) return null;
    if (!Array.isArray(parsed.objectTypes)) return null;

    const collectionGroups: SuggestedCollectionGroup[] = [];
    for (const item of parsed.collectionGroups) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as { name?: unknown }).name !== "string" ||
        typeof (item as { description?: unknown }).description !== "string"
      ) {
        return null;
      }
      const name = (item as { name: string }).name.trim();
      if (!name) return null;
      collectionGroups.push({
        name: name.slice(0, 120),
        description: trimDescription(
          (item as { description: string }).description,
        ),
      });
      if (collectionGroups.length >= 8) break;
    }

    if (collectionGroups.length === 0) return null;

    const objectTypes: Array<string> = [];
    for (const value of parsed.objectTypes) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      objectTypes.push(trimmed);
      if (objectTypes.length >= 12) break;
    }

    return {
      summary: trimDescription(parsed.summary, 400),
      collectionGroups,
      objectTypes,
      source: "ai",
    };
  } catch {
    return null;
  }
}
