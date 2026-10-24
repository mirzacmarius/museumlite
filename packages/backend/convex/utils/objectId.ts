import type {
  DocumentationRequirement,
  DocumentationStage,
} from "./documentationQualityValidators";

/**
 * The Object ID checklist: the nine categories that describe an object well
 * enough to identify it if it is lost or stolen, in the checklist's order.
 * A sheet also carries photographs and a short description.
 */
export const OBJECT_ID_CATEGORIES = [
  "type_of_object",
  "materials_and_techniques",
  "measurements",
  "inscriptions_and_markings",
  "distinguishing_features",
  "title",
  "subject",
  "date_or_period",
  "maker",
] as const;

export type ObjectIdCategory = (typeof OBJECT_ID_CATEGORIES)[number];

/** The Documentation profile that checks Objects against the checklist. */
export const OBJECT_ID_PROFILE_NAME = "Object ID";

/**
 * Objects in the collection or borrowed are the ones a theft report would
 * concern. Every checklist category has a requirement except the title, which
 * is always recorded: distinguishing features come from the accepted
 * condition assessment and the subject from the tags, as on the sheet.
 */
export const OBJECT_ID_PROFILE_STAGES: readonly DocumentationStage[] = [
  "collection",
  "borrowed",
];

export const OBJECT_ID_PROFILE_REQUIREMENTS: readonly DocumentationRequirement[] =
  [
    "object_type",
    "materials",
    "dimensions",
    "inscriptions",
    "condition_assessment",
    "subject",
    "production_date",
    "maker",
    "description",
    "image",
  ];

export function isObjectIdProfileName(name: string) {
  return name.trim().toLowerCase() === OBJECT_ID_PROFILE_NAME.toLowerCase();
}
