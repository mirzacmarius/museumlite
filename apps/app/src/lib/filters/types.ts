export type FilterOperator =
  | "is"
  | "is not"
  | "includes"
  | "contains"
  | "before"
  | "after";

export type FilterFieldType = "text" | "enum" | "date" | "number" | "boolean";

export interface FilterField {
  name: string;
  label: string;
  type: FilterFieldType;
  operators: FilterOperator[];
  autocomplete?: () => Promise<string[]> | string[];
  placeholder?: string;
}

export interface FilterCondition {
  field: string;
  operator: FilterOperator | null;
  value: string;
}

export interface ParsedFilters {
  conditions: FilterCondition[];
  search?: string;
}

export interface FilterSchema {
  fields: FilterField[];
  searchPlaceholder?: string;
}
