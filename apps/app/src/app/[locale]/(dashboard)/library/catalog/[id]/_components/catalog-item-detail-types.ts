export const CONDITION_VALUES = [
  "new",
  "excellent",
  "good",
  "fair",
  "poor",
] as const;

export type Condition = (typeof CONDITION_VALUES)[number];
