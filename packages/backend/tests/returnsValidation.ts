import { expect } from "vitest";

/**
 * convex-test does not enforce `returns` validators, while Convex rejects any
 * value that does not match (including unexpected fields). These helpers
 * check a returned value against a function's exported validator.
 */
type FieldJson = { fieldType: ValidatorJson; optional: boolean };
type ValidatorJson =
  | { type: "null" | "number" | "bigint" | "boolean" | "string" | "bytes" }
  | { type: "any" }
  | { type: "literal"; value: unknown }
  | { type: "id"; tableName: string }
  | { type: "array"; value: ValidatorJson }
  | { type: "record"; keys: ValidatorJson; values: FieldJson }
  | { type: "object"; value: Record<string, FieldJson> }
  | { type: "union"; value: ValidatorJson[] };

interface RegisteredFunction {
  exportReturns(): string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mismatch(
  validator: ValidatorJson,
  value: unknown,
  path: string,
): string | null {
  switch (validator.type) {
    case "any":
      return null;
    case "null":
      return value === null ? null : `${path}: expected null`;
    case "number":
      return typeof value === "number" ? null : `${path}: expected number`;
    case "bigint":
      return typeof value === "bigint" ? null : `${path}: expected bigint`;
    case "boolean":
      return typeof value === "boolean" ? null : `${path}: expected boolean`;
    case "string":
    case "id":
      return typeof value === "string" ? null : `${path}: expected string`;
    case "bytes":
      return value instanceof ArrayBuffer ? null : `${path}: expected bytes`;
    case "literal":
      return value === validator.value
        ? null
        : `${path}: expected ${JSON.stringify(validator.value)}`;
    case "array":
      if (!Array.isArray(value)) return `${path}: expected array`;
      for (const [index, item] of value.entries()) {
        const problem = mismatch(validator.value, item, `${path}[${index}]`);
        if (problem) return problem;
      }
      return null;
    case "record":
      if (!isPlainObject(value)) return `${path}: expected record`;
      for (const [key, item] of Object.entries(value)) {
        const problem = mismatch(
          validator.values.fieldType,
          item,
          `${path}.${key}`,
        );
        if (problem) return problem;
      }
      return null;
    case "object": {
      if (!isPlainObject(value)) return `${path}: expected object`;
      for (const key of Object.keys(value)) {
        if (!(key in validator.value) && value[key] !== undefined) {
          return `${path}.${key}: unexpected field`;
        }
      }
      for (const [key, field] of Object.entries(validator.value)) {
        if (value[key] === undefined) {
          if (!field.optional) return `${path}.${key}: missing`;
          continue;
        }
        const problem = mismatch(field.fieldType, value[key], `${path}.${key}`);
        if (problem) return problem;
      }
      return null;
    }
    case "union": {
      const problems = validator.value.map((option) =>
        mismatch(option, value, path),
      );
      return problems.some((problem) => problem === null)
        ? null
        : (problems.find((problem) => problem?.includes("unexpected field")) ??
            problems[0] ??
            `${path}: no union member matched`);
    }
  }
}

export function expectMatchesReturns(fn: unknown, value: unknown) {
  const registered = fn as RegisteredFunction;
  const validator = JSON.parse(registered.exportReturns()) as ValidatorJson;
  expect(mismatch(validator, value, "result")).toBeNull();
}
