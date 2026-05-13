import { v } from "convex/values";

export const enabledModuleValidator = v.union(
  v.literal("library"),
  v.literal("fine_art"),
  v.literal("wine"),
  v.literal("automotive"),
  v.literal("natural_history"),
  v.literal("archive"),
  v.literal("accounts"),
  v.literal("coins_stamps"),
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
