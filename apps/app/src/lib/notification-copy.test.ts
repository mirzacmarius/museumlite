import { describe, expect, it } from "vitest";
import french from "../locales/fr";
import romanian from "../locales/ro";
import { getNotificationCopy } from "./notification-copy";

function translate(key: string, values?: Record<string, string | number>) {
  return `${key}:${JSON.stringify(values ?? {})}`;
}

function dictionaryTranslator(dictionary: object) {
  return (key: string, values?: Record<string, string | number>) => {
    let value: unknown = dictionary;
    for (const part of key.split(".")) {
      if (typeof value !== "object" || value === null) {
        throw new Error(`Missing translation: ${key}`);
      }
      value = Reflect.get(value, part);
    }
    if (typeof value !== "string") {
      throw new Error(`Missing translation: ${key}`);
    }
    return value.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in (values ?? {}) ? String(values?.[name]) : match,
    );
  };
}

describe("getNotificationCopy", () => {
  it("translates built-in notification templates and preserves interpolated identifiers", () => {
    expect(
      getNotificationCopy(
        {
          title: "Accession Requires Your Approval",
          message: "Accession ACC-2026-014 is pending your approval at step 2.",
        },
        translate,
      ),
    ).toEqual({
      title:
        "untranslatedComponents.notificationCopy.titles.accessionRequiresYourApproval:{}",
      message:
        'untranslatedComponents.notificationCopy.messages.accessionPendingAtStep:{"number":"ACC-2026-014","step":"2"}',
    });
  });

  it("localizes insurance policy value with one USD symbol", () => {
    expect(
      getNotificationCopy(
        {
          title: "Insurance Policy Expiring in 30 Days",
          message:
            "Policy POL-1 (Lloyd's) covering 4 items worth $125,000 expires in 30 days.",
        },
        dictionaryTranslator(french),
      ),
    ).toEqual({
      title: "La police d’assurance expire dans 30 jours",
      message:
        "La police POL-1 (Lloyd's), qui couvre 4 objets d’une valeur de $125,000, expire dans 30 jours.",
    });
  });

  it("translates built-in task copy while retaining user-provided task text", () => {
    expect(
      getNotificationCopy(
        {
          title: "Task Blocked",
          message:
            'Task "Repair frame" has been blocked: Waiting for conservator',
        },
        translate,
      ).message,
    ).toBe(
      'untranslatedComponents.notificationCopy.messages.taskBlocked:{"title":"Repair frame","reason":"Waiting for conservator"}',
    );
  });

  it("translates loan approval workflows and preserves loan numbers and direction", () => {
    expect(
      getNotificationCopy(
        {
          title: "New Loan Requires Approval",
          message: "Loan LN-104 (incoming) is pending your approval at step 3.",
        },
        translate,
      ).message,
    ).toBe(
      'untranslatedComponents.notificationCopy.messages.newLoanPendingAtStep:{"number":"LN-104","direction":"untranslatedComponents.notificationCopy.loanTypes.incoming:{}","step":"3"}',
    );
  });

  it("translates acquisition workflow copy while preserving the request title", () => {
    expect(
      getNotificationCopy(
        {
          title: "Acquisition Request Approved",
          message:
            'Acquisition request for "A New History of the City" has been approved.',
        },
        translate,
      ),
    ).toEqual({
      title:
        "untranslatedComponents.notificationCopy.titles.acquisitionRequestApproved:{}",
      message:
        'untranslatedComponents.notificationCopy.messages.acquisitionApproved:{"title":"A New History of the City"}',
    });
  });

  it("leaves system announcements unchanged even when they resemble a built-in", () => {
    const announcement = {
      type: "system_announcement",
      title: "Accession Approved",
      message:
        "Accession ACC-2026-014 has been approved and added to the collection.",
    };
    expect(getNotificationCopy(announcement, translate)).toEqual({
      title: announcement.title,
      message: announcement.message,
    });
  });

  it.each([
    ["French", french],
    ["Romanian", romanian],
  ])("uses %s translations for built-in approval copy", (_locale, dictionary) => {
    const copy = getNotificationCopy(
      {
        title: "Accession Requires Your Approval",
        message: "Accession ACC-2026-014 is pending your approval at step 2.",
      },
      dictionaryTranslator(dictionary),
    );
    expect(copy.title).not.toBe("Accession Requires Your Approval");
    expect(copy.message).toContain("ACC-2026-014");
    expect(copy.message).not.toContain("pending your approval at step");
  });
});
