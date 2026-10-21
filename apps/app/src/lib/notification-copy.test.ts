import { describe, expect, it } from "vitest";
import french from "../locales/fr";
import norwegian from "../locales/no";
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

  it("translates alert episode notifications measure by measure", () => {
    const copy = (title: string, message: string) =>
      getNotificationCopy(
        { title, message, type: "environmental_alert" },
        dictionaryTranslator(french),
      );

    expect(
      copy(
        "Environment out of range: Paper Store",
        "Temperature 23.5 °C above the 22 °C maximum; Relative humidity 61% above the 55% maximum.",
      ),
    ).toEqual({
      title: "Environnement hors seuils : Paper Store",
      message:
        "Température 23.5 °C au-dessus du maximum de 22 °C; Humidité relative 61 % au-dessus du maximum de 55 %.",
    });
    expect(
      copy(
        "Environment still out of range: Paper Store",
        "Out of range for over 24 hours. Relative humidity 35% below the 40% minimum.",
      ).message,
    ).toBe(
      "Hors des seuils depuis plus d'un jour. Humidité relative 35 % en dessous du minimum de 40 %.",
    );
    expect(
      copy(
        "Environment back in range: Paper Store",
        "Readings are back within the thresholds. Highest relative humidity 63%; Lowest temperature 16 °C.",
      ),
    ).toEqual({
      title: "Environnement revenu dans les seuils : Paper Store",
      message:
        "Les mesures sont revenues dans les seuils. Humidité relative maximale 63 %; Température minimale 16 °C.",
    });
    expect(
      copy("Environment out of range: Paper Store", "Something unexpected.")
        .message,
    ).toBe("Something unexpected.");
  });

  it("translates batch job outcomes with the job's own label", () => {
    expect(
      getNotificationCopy(
        {
          title: "Bulk Edit completed with 2 errors",
          message: "Processed 3 of 5 items.",
        },
        dictionaryTranslator(french),
      ),
    ).toEqual({
      title: "Modification en masse : traitement terminé avec 2 erreurs",
      message: "3 objets sur 5 traités.",
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

  it("localizes insurance expiry values per currency without adding them up", () => {
    expect(
      getNotificationCopy(
        {
          title: "Insurance Policy Expiring in 7 Days",
          message:
            "Policy POL-2 (Lloyd's) covering 3 items valued at EUR 30,000; USD 13,500 expires in 7 days.",
        },
        dictionaryTranslator(french),
      ),
    ).toEqual({
      title: "La police d’assurance expire dans 7 jours",
      message:
        "La police POL-2 (Lloyd's), qui couvre 3 objets d’une valeur de EUR 30,000; USD 13,500, expire dans 7 jours.",
    });
    expect(
      getNotificationCopy(
        {
          title: "Insurance Policy Expiring in 14 Days",
          message: "Policy POL-3 (Mutual) covering 0 items expires in 14 days.",
        },
        dictionaryTranslator(romanian),
      ).message,
    ).toBe("Polița POL-3 (Mutual), care acoperă 0 obiecte, expiră în 14 zile.");
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

  it.each([
    [
      "Task Ready for Review",
      'Task "Check courier" is ready for your review',
      "taskReadyForReview",
    ],
    [
      "Task Returned",
      'Task "Check courier" was returned for changes',
      "taskReturned",
    ],
    ["Task Approved", 'Task "Check courier" was approved', "taskApproved"],
  ])("translates case task review copy for %s", (title, message, key) => {
    expect(getNotificationCopy({ title, message }, translate)).toEqual({
      title: `untranslatedComponents.notificationCopy.titles.${key}:{}`,
      message: `untranslatedComponents.notificationCopy.messages.${key}:{"title":"Check courier"}`,
    });
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

  it("translates a cancelled object move and keeps an administrator's own notes as written", () => {
    const cancelled = (message: string) =>
      getNotificationCopy(
        {
          type: "move_request_cancelled",
          title: "Object Move Cancelled",
          message,
        },
        dictionaryTranslator(french),
      );

    expect(
      cancelled(
        "Your object move request was cancelled by an administrator of the source organization.",
      ),
    ).toEqual({
      title: "Transfert de l’objet annulé",
      message:
        "Votre demande de transfert d’objet a été annulée par un administrateur de l’organisation d’origine.",
    });
    expect(cancelled("Doublon d’une demande précédente.").message).toBe(
      "Doublon d’une demande précédente.",
    );
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

  it("tells the sender in their language that the receiver declined a transfer", () => {
    const copy = (message: string) =>
      getNotificationCopy(
        { title: "Transfer Declined", message },
        dictionaryTranslator(french),
      );

    expect(
      copy("Museum Nord declined the transfer of Vase. Reason: No space."),
    ).toEqual({
      title: "Transfert refusé",
      message: "Museum Nord a refusé le transfert de Vase. Motif : No space.",
    });
    expect(copy("Museum Nord declined the transfer of St. Olav.")).toEqual({
      title: "Transfert refusé",
      message: "Museum Nord a refusé le transfert de St. Olav.",
    });
  });

  it("tells the receiver in their language that the sender cancelled a transfer", () => {
    const copy = (message: string) =>
      getNotificationCopy(
        { title: "Transfer Cancelled", message },
        dictionaryTranslator(norwegian),
      );

    expect(
      copy("Museum Sør cancelled the transfer of Vase. Reason: Sold."),
    ).toEqual({
      title: "Overføring avbrutt",
      message: "Museum Sør avbrøt overføringen av Vase. Begrunnelse: Sold.",
    });
    expect(copy("Museum Sør cancelled the transfer of St. Olav.")).toEqual({
      title: "Overføring avbrutt",
      message: "Museum Sør avbrøt overføringen av St. Olav.",
    });
  });
});
