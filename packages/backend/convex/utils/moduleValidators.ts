import { v } from "convex/values";
import { COLLECTION_TYPE_IDS, MODULE_IDS } from "./moduleCatalog";

export const ENABLED_MODULE_VALIDATOR_IDS = MODULE_IDS;
export const COLLECTION_TYPE_VALIDATOR_IDS = COLLECTION_TYPE_IDS;

export const enabledModuleValidator = v.union(
  v.literal("library"),
  v.literal("fine_art"),
  v.literal("wine"),
  v.literal("automotive"),
  v.literal("natural_history"),
  v.literal("archive"),
  v.literal("accounts"),
  v.literal("coins_stamps"),
  v.literal("inventory_valuation"),
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
