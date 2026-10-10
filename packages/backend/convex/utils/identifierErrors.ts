import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";
import type { IdentifierRegister } from "./identifiers";

/**
 * Stable codes for identifier refusals staff can resolve. Clients map these
 * to translated copy; `message` is English for logs and import row errors.
 */
export const IDENTIFIER_CODES = [
  /** Empty, longer than 256 characters, or containing control characters. */
  "IDENTIFIER_INVALID",
  /** Another record in the same register already uses the number. */
  "IDENTIFIER_IN_USE",
  /** Historical numbers must be indexed before new ones are assigned. */
  "IDENTIFIER_REVIEW_REQUIRED",
  /** No numbering format is configured to generate a number. */
  "NUMBERING_NOT_CONFIGURED",
  /** The numbering format kept producing numbers that are in use. */
  "NUMBERING_EXHAUSTED",
  /** Only a pending, unpublished accession can change its catalog number. */
  "CATALOG_NUMBER_LOCKED",
] as const;

export type IdentifierCode = (typeof IDENTIFIER_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type IdentifierErrorData = {
  code: IdentifierCode;
  message: string;
  register?: IdentifierRegister;
  identifier?: string;
};

export function identifierError(
  code: IdentifierCode,
  message: string,
  details: { register?: IdentifierRegister; identifier?: string } = {},
): ConvexError<IdentifierErrorData> {
  return new ConvexError({ code, message, ...details });
}

/** Reads an identifier refusal from a thrown error; null for any other failure. */
export function identifierErrorFromError(
  error: unknown,
): IdentifierErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = IDENTIFIER_CODES.find((candidate) => candidate === data.code);
  if (!code) return null;
  const message = "message" in data ? data.message : undefined;
  const register = "register" in data ? data.register : undefined;
  const identifier = "identifier" in data ? data.identifier : undefined;
  return {
    code,
    message: typeof message === "string" ? message : code,
    ...(register === "catalog" || register === "accession" ? { register } : {}),
    ...(typeof identifier === "string" ? { identifier } : {}),
  };
}
