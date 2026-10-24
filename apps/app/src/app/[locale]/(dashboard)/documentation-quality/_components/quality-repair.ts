import type { api } from "@v1/backend/convex/_generated/api";
import type { DocumentationRequirement } from "@v1/backend/convex/utils/documentationQualityValidators";
import type { FunctionReturnType } from "convex/server";

export type FindingView = NonNullable<
  FunctionReturnType<typeof api.documentationQuality.getFinding>
>;
export type Finding = FindingView["finding"];
export type FindingRecord = FindingView["records"][number];

type ObjectTab =
  | "general"
  | "physical"
  | "media"
  | "accession"
  | "placement"
  | "provenance";

/** The object tab where staff record each kind of documentation. */
const REQUIREMENT_TABS: Record<DocumentationRequirement, ObjectTab> = {
  object_type: "general",
  object_name: "general",
  maker: "general",
  production_date: "general",
  description: "general",
  materials: "physical",
  dimensions: "physical",
  inscriptions: "physical",
  condition_assessment: "physical",
  image: "media",
  supporting_document: "media",
  current_location: "placement",
  accession_record: "accession",
  provenance_claim: "provenance",
};

type OrphanField = Extract<Finding, { kind: "orphan_reference" }>["field"];

/** The object tab holding each reference; others are not on an object. */
const ORPHAN_FIELD_TABS: Record<OrphanField, ObjectTab | undefined> = {
  parentObject: "general",
  collectionGroup: "general",
  currentLocation: "placement",
  object: undefined,
  donorAccount: undefined,
};

/** Missing requirements grouped by the object tab that records them. */
export function requirementsByTab(
  missing: readonly DocumentationRequirement[],
): Array<{ tab: ObjectTab; requirements: DocumentationRequirement[] }> {
  const groups = new Map<ObjectTab, DocumentationRequirement[]>();
  for (const requirement of missing) {
    const tab = REQUIREMENT_TABS[requirement];
    groups.set(tab, [...(groups.get(tab) ?? []), requirement]);
  }
  return Array.from(groups, ([tab, requirements]) => ({ tab, requirements }));
}

/** Where a record of a finding is opened for repair. */
export function recordHref(record: FindingRecord, tab?: ObjectTab) {
  switch (record.type) {
    case "object":
      return tab ? `/objects/${record.id}?tab=${tab}` : `/objects/${record.id}`;
    case "accession":
      return `/accessions/${record.id}`;
    case "deaccession":
      return `/deaccessions/${record.id}`;
  }
}

export function orphanFieldTab(field: OrphanField) {
  return ORPHAN_FIELD_TABS[field];
}
