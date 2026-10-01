import { z } from "zod";

export const emailSchema = z.string().trim().max(254).email();
export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => {
    if (value === "") return true;
    const digits = value.replace(/\D/g, "");
    return (
      /^\+?[0-9 ()-]{7,32}$/.test(value) &&
      digits.length >= 7 &&
      digits.length <= 15
    );
  });
export const passwordSchema = z.string().min(8).max(1024);

export type EmailError =
  | "generic"
  | "invalidEmail"
  | "emailInUse"
  | "emailUnchanged"
  | "throttled"
  | "invalidCode"
  | "expired"
  | "noPending"
  | "support"
  | null;

export function getEmailError(code: string): Exclude<EmailError, null> {
  switch (code) {
    case "INVALID_EMAIL":
      return "invalidEmail";
    case "EMAIL_IN_USE":
      return "emailInUse";
    case "EMAIL_UNCHANGED":
      return "emailUnchanged";
    case "EMAIL_SEND_THROTTLED":
      return "throttled";
    case "INVALID_CODE":
      return "invalidCode";
    case "EMAIL_CODE_EXPIRED":
      return "expired";
    case "NO_PENDING_EMAIL_CHANGE":
      return "noPending";
    case "MULTIPLE_EMAIL_ACCOUNTS":
      return "support";
    default:
      return "generic";
  }
}
