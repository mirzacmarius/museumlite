import { v } from "convex/values";
import {
  COLLECTION_TYPE_IDS,
  DEFAULT_ON_MODULE_IDS,
  MODULE_IDS,
  OPT_IN_MODULE_IDS,
} from "./moduleCatalog";

export const COLLECTION_TYPE_VALIDATOR_IDS = COLLECTION_TYPE_IDS;

export const enabledModuleValidator = v.union(
  ...OPT_IN_MODULE_IDS.map((moduleId) => v.literal(moduleId)),
);

export const disabledModuleValidator = v.union(
  ...DEFAULT_ON_MODULE_IDS.map((moduleId) => v.literal(moduleId)),
);

export const moduleIdValidator = v.union(
  ...MODULE_IDS.map((moduleId) => v.literal(moduleId)),
);

export const collectionTypeValidator = v.union(
  v.literal("general"),
  v.literal("fine_art"),
  v.literal("wine"),
  v.literal("automotive"),
  v.literal("natural_history"),
  v.literal("archive"),
  v.literal("coins_stamps"),
);
