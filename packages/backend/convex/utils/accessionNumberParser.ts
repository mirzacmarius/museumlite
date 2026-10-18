/**
 * Accession Number Template Parser
 *
 * Supports flexible template-based accession number generation
 * with date/time components, counters, and organization info.
 */

import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

export interface ParserContext {
  organizationSlug: string;
  currentDate: Date;
  counterValue: number;
  counterScope?: "global" | "year" | "month" | "day";
}

/**
 * Why a format cannot number objects. Clients map each code to translated
 * copy; `variable` is the offending `{...}` text for UNKNOWN_VARIABLE.
 */
export type AccessionFormatIssue =
  | { code: "FORMAT_EMPTY" }
  | { code: "COUNTER_MISSING" }
  | { code: "UNKNOWN_VARIABLE"; variable: string };

export interface ValidationResult {
  isValid: boolean;
  /** English summary of `issues`, for logs only. */
  error?: string;
  issues: AccessionFormatIssue[];
  preview: string;
  examples: string[];
}

/**
 * Organizations seeded before MUS-802 stored formats such as `NAT-YYYY-###`,
 * with bare tokens. A stored format without any brace is read in that syntax:
 * a bare `YYYY` is the year and a run of `#` is the counter. Braced variables
 * are canonical: a format that uses a brace keeps `YYYY` and `#` literal, and
 * a new format must use braces (see `validate`).
 */
export function canonicalAccessionTemplate(template: string): string {
  if (/[{}]/.test(template)) return template;
  return template
    .replace(/YYYY/g, "{YYYY}")
    .replace(/#+/g, (hashes) => `{${hashes}}`);
}

const ISSUE_MESSAGES: Record<AccessionFormatIssue["code"], string> = {
  FORMAT_EMPTY: "Template cannot be empty",
  COUNTER_MISSING:
    "Template must contain at least one counter variable ({####}, {###}, etc.)",
  UNKNOWN_VARIABLE: "Invalid variable",
};

function issueMessage(issue: AccessionFormatIssue): string {
  return issue.code === "UNKNOWN_VARIABLE"
    ? `${ISSUE_MESSAGES[issue.code]}: ${issue.variable}`
    : ISSUE_MESSAGES[issue.code];
}

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type AccessionFormatErrorData = {
  code: "ACCESSION_FORMAT_INVALID";
  message: string;
  issues: AccessionFormatIssue[];
};

/** Refuses saving a format that cannot number objects. */
export function accessionFormatError(
  validation: Pick<ValidationResult, "issues">,
): ConvexError<AccessionFormatErrorData> {
  return new ConvexError({
    code: "ACCESSION_FORMAT_INVALID",
    message: `Invalid accession number format: ${validation.issues.map(issueMessage).join(". ")}`,
    issues: validation.issues,
  });
}

function readIssue(value: unknown): AccessionFormatIssue | null {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return null;
  }
  switch (value.code) {
    case "FORMAT_EMPTY":
    case "COUNTER_MISSING":
      return { code: value.code };
    case "UNKNOWN_VARIABLE":
      return "variable" in value && typeof value.variable === "string"
        ? { code: value.code, variable: value.variable }
        : null;
    default:
      return null;
  }
}

/** Reads a format refusal from a thrown error; null for any other failure. */
export function accessionFormatErrorFromError(
  error: unknown,
): AccessionFormatErrorData | null {
  const data = convexErrorData(error);
  if (
    typeof data !== "object" ||
    data === null ||
    !("code" in data) ||
    data.code !== "ACCESSION_FORMAT_INVALID"
  ) {
    return null;
  }
  const issues =
    "issues" in data && Array.isArray(data.issues)
      ? data.issues.flatMap((issue) => readIssue(issue) ?? [])
      : [];
  const message = "message" in data ? data.message : undefined;
  return {
    code: "ACCESSION_FORMAT_INVALID",
    message: typeof message === "string" ? message : data.code,
    issues,
  };
}

export class AccessionNumberParser {
  /**
   * Generate an accession number from a stored template
   */
  parse(template: string, context: ParserContext): string {
    return this.substitute(canonicalAccessionTemplate(template), context);
  }

  private substitute(template: string, context: ParserContext): string {
    let result = template;
    const { organizationSlug, currentDate, counterValue } = context;

    // Day of week names
    const dayNamesShort = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ] as const;
    const dayNamesFull = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ] as const;

    // Date/Time replacements
    result = result.replace(/\{YYYY\}/g, currentDate.getFullYear().toString());
    result = result.replace(
      /\{YY\}/g,
      currentDate.getFullYear().toString().slice(-2),
    );
    result = result.replace(/\{MM\}/g, this.pad(currentDate.getMonth() + 1, 2));
    result = result.replace(/\{M\}/g, (currentDate.getMonth() + 1).toString());
    result = result.replace(/\{DD\}/g, this.pad(currentDate.getDate(), 2));
    result = result.replace(/\{D\}/g, currentDate.getDate().toString());

    // Day of week replacements
    const dayOfWeek = currentDate.getDay();
    result = result.replace(/\{DDDD\}/g, dayNamesFull[dayOfWeek] || "");
    result = result.replace(/\{DDD\}/g, dayNamesShort[dayOfWeek] || "");
    result = result.replace(/\{d\}/g, currentDate.getDay().toString());

    result = result.replace(/\{HH\}/g, this.pad(currentDate.getHours(), 2));
    result = result.replace(/\{mm\}/g, this.pad(currentDate.getMinutes(), 2));
    result = result.replace(/\{ss\}/g, this.pad(currentDate.getSeconds(), 2));
    result = result.replace(/\{s\}/g, currentDate.getSeconds().toString());
    result = result.replace(
      /\{SSS\}/g,
      this.pad(currentDate.getMilliseconds(), 3),
    );
    result = result.replace(
      /\{MS\}/g,
      this.pad(Math.floor(currentDate.getMilliseconds() / 10), 2),
    );
    result = result.replace(
      /\{UNIX\}/g,
      Math.floor(currentDate.getTime() / 1000).toString(),
    );

    // Quarter
    const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
    result = result.replace(/\{Q\}/g, quarter.toString());

    // Week of year
    const weekNumber = this.getWeekNumber(currentDate);
    result = result.replace(/\{WW\}/g, this.pad(weekNumber, 2));
    result = result.replace(/\{W\}/g, weekNumber.toString());

    // Organization replacements
    result = result.replace(/\{ORG:(\d+)\}/g, (_, length) => {
      return organizationSlug.toUpperCase().substring(0, parseInt(length, 10));
    });
    result = result.replace(/\{ORG\}/g, organizationSlug.toUpperCase());
    result = result.replace(/\{org:(\d+)\}/g, (_, length) => {
      return organizationSlug.toLowerCase().substring(0, parseInt(length, 10));
    });
    result = result.replace(/\{org\}/g, organizationSlug.toLowerCase());

    // Counter replacements
    result = result.replace(
      /\{COUNTER:(\d+)(?::(?:YEAR|MONTH|DAY|GLOBAL))?\}/g,
      (_, padding) => {
        return this.formatCounter(counterValue, parseInt(padding, 10));
      },
    );
    // Handle dynamic # patterns (1-10 digits)
    result = result.replace(/\{(#{1,10})\}/g, (_match, hashes) => {
      return this.formatCounter(counterValue, hashes.length);
    });

    return result;
  }

  /**
   * Validate a template in the braced syntax. With `stored`, the template is
   * one already saved, which may still use the bare syntax.
   */
  validate(
    template: string,
    organizationSlug: string,
    { stored = false }: { stored?: boolean } = {},
  ): ValidationResult {
    if (!template || template.trim() === "") {
      const issues: AccessionFormatIssue[] = [{ code: "FORMAT_EMPTY" }];
      return {
        isValid: false,
        error: issues.map(issueMessage).join(". "),
        issues,
        preview: "",
        examples: [],
      };
    }

    const canonical = stored ? canonicalAccessionTemplate(template) : template;
    const validTokenPattern =
      /\{(?:YYYY|YY|MM|M|DD|D|DDDD|DDD|d|HH|mm|ss|s|SSS|MS|UNIX|Q|WW|W|ORG(?::\d+)?|org(?::\d+)?|COUNTER:\d+(?::(?:YEAR|MONTH|DAY|GLOBAL))?|#{1,10})\}/;
    const issues: AccessionFormatIssue[] = (
      canonical.match(/\{[^}]+\}/g) ?? []
    ).flatMap((token) =>
      validTokenPattern.test(token)
        ? []
        : [{ code: "UNKNOWN_VARIABLE" as const, variable: token }],
    );
    const hasCounter =
      /\{(?:COUNTER:\d+(?::(?:YEAR|MONTH|DAY|GLOBAL))?|#{1,10})\}/.test(
        canonical,
      );
    if (!hasCounter) {
      issues.push({ code: "COUNTER_MISSING" });
    }

    const testContext: ParserContext = {
      organizationSlug,
      currentDate: new Date(),
      counterValue: 1,
      counterScope: "year",
    };
    const examples =
      issues.length === 0
        ? [1, 2, 3].map((counterValue) =>
            this.substitute(canonical, { ...testContext, counterValue }),
          )
        : [];

    return {
      isValid: issues.length === 0,
      error: issues.map(issueMessage).join(". "),
      issues,
      preview: this.substitute(canonical, testContext),
      examples,
    };
  }

  /**
   * Get scope key for counter tracking
   */
  getScopeKey(scope: "global" | "year" | "month" | "day", date: Date): string {
    switch (scope) {
      case "year":
        return date.getFullYear().toString();
      case "month":
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1, 2)}`;
      case "day":
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1, 2)}-${this.pad(date.getDate(), 2)}`;
      default:
        return "global";
    }
  }

  /**
   * Extract counter scope from template
   */
  getCounterScopeFromTemplate(
    storedTemplate: string,
  ): "global" | "year" | "month" | "day" {
    const template = canonicalAccessionTemplate(storedTemplate);
    const scopeMatch = template.match(
      /\{COUNTER:\d+:(YEAR|MONTH|DAY|GLOBAL)\}/,
    );
    if (scopeMatch?.[1]) {
      return scopeMatch[1].toLowerCase() as "global" | "year" | "month" | "day";
    }
    // Default scope based on template content
    if (template.includes("{DD}") || template.includes("{D}")) {
      return "day";
    }
    if (template.includes("{MM}") || template.includes("{M}")) {
      return "month";
    }
    if (template.includes("{YYYY}") || template.includes("{YY}")) {
      return "year";
    }
    return "global";
  }

  /**
   * Format counter with padding
   */
  private formatCounter(value: number, padding: number): string {
    return value.toString().padStart(padding, "0");
  }

  /**
   * Pad number with leading zeros
   */
  private pad(num: number, size: number): string {
    return num.toString().padStart(size, "0");
  }

  /**
   * Get ISO week number for a date
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Get template presets
   */
  static getPresets(): Array<{
    name: string;
    template: string;
    description: string;
  }> {
    return [
      {
        name: "Standard Museum",
        template: "{ORG:3}-{YYYY}-{####}",
        description:
          "Organization prefix with year and 4-digit counter (e.g., MUS-2025-0001)",
      },
      {
        name: "Date-based",
        template: "{YYYY}{MM}{DD}-{####}",
        description: "Full date with 4-digit counter (e.g., 20251002-0001)",
      },
      {
        name: "Simple Year",
        template: "{YYYY}.{####}",
        description: "Year with 4-digit counter (e.g., 2025.0001)",
      },
      {
        name: "Full Timestamp",
        template: "{YYYY}{MM}{DD}{HH}{mm}{ss}{####}",
        description:
          "Complete timestamp with counter (e.g., 202510021714500001)",
      },
      {
        name: "Day of Week",
        template: "{YYYY}-{DDD}-{####}",
        description: "Year, day of week, counter (e.g., 2025-Mon-0001)",
      },
      {
        name: "Quarterly",
        template: "{YYYY}Q{Q}-{####}",
        description: "Year with quarter (e.g., 2025Q4-0001)",
      },
      {
        name: "Weekly",
        template: "{YYYY}W{WW}-{###}",
        description: "Year with week number (e.g., 2025W40-001)",
      },
      {
        name: "Gallery Style",
        template: "{org}/{YY}/{###}",
        description:
          "Lowercase org, 2-digit year, 3-digit counter (e.g., gallery/25/001)",
      },
      {
        name: "Monthly Reset",
        template: "{YYYY}-{MM}-{COUNTER:4:MONTH}",
        description: "Counter resets each month (e.g., 2025-10-0001)",
      },
    ];
  }
}

// Export singleton instance
export const accessionParser = new AccessionNumberParser();
