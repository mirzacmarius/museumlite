import { describe, expect, test } from "vitest";
import {
  buildObjectDraftPayload,
  createFormDataFromDraftObject,
} from "./utils";

describe("object draft form serialization", () => {
  test("round trips catalog fields without serializing editor-only IDs", () => {
    const formData = createFormDataFromDraftObject({
      title: "Bronze vessel",
      accessionNumber: "2026.14",
      alternateAccessionNumbers: ["ALT-14"],
      collectionType: "general",
      previous_owners: ["B. Antiquarian"],
      dimensionDiameter: "43 mm",
      dimensionWeight: 2,
      weightUnit: "kg",
      ownershipHistory: [
        {
          owner: "A. Collector",
          startYear: "1890",
          endYear: "1910",
          description: "Inherited by the family",
          verified: true,
          verificationSource: "Estate inventory",
        },
      ],
      links: [{ url: "https://example.org/object", label: "Archive record" }],
      isPubliclyVisible: true,
      isHighResDownloadable: true,
      isSearchable: false,
      isValuationVisible: true,
    });

    expect(formData.ownershipHistory?.[0]?.localId).toBeTruthy();
    expect(formData.links?.[0]?.localId).toBeTruthy();

    const payload = buildObjectDraftPayload(formData);

    expect(payload).toMatchObject({
      title: "Bronze vessel",
      accessionNumber: "2026.14",
      alternateAccessionNumbers: ["ALT-14"],
      collectionType: "general",
      previous_owners: ["B. Antiquarian"],
      dimensionDiameter: "43 mm",
      dimensionWeight: 2,
      weightUnit: "kg",
      ownershipHistory: [
        {
          owner: "A. Collector",
          startYear: "1890",
          endYear: "1910",
          description: "Inherited by the family",
          verified: true,
          verificationSource: "Estate inventory",
        },
      ],
      links: [{ url: "https://example.org/object", label: "Archive record" }],
      isPubliclyVisible: true,
      isHighResDownloadable: true,
      isSearchable: false,
      isValuationVisible: true,
    });
    expect(payload.ownershipHistory?.[0]).not.toHaveProperty("localId");
    expect(payload.links?.[0]).not.toHaveProperty("localId");
  });

  test("keeps every catalog field an intake draft can hold", () => {
    const formData = createFormDataFromDraftObject({
      title: "Herring net",
      alternativeTitle: "Sildegarn",
      technique: "Knotted",
      dimensionHeight: 120,
      dimensionWidth: 340.5,
      dimensionDepth: 4,
      dimensionUnit: "cm",
      inscriptionMarks: [
        { label: "Owner's mark", description: "Burnt initials H.O." },
      ],
      tags: ["fishing", "coastal"],
      creditLine: "Gift of the Olsen family, 2026",
      legalRestrictions: true,
    });

    const payload = buildObjectDraftPayload(formData);

    expect(payload).toMatchObject({
      alternativeTitle: "Sildegarn",
      technique: "Knotted",
      dimensionHeight: 120,
      dimensionWidth: 340.5,
      dimensionDepth: 4,
      dimensionUnit: "cm",
      inscriptionMarks: [
        { label: "Owner's mark", description: "Burnt initials H.O." },
      ],
      tags: ["fishing", "coastal"],
      creditLine: "Gift of the Olsen family, 2026",
      legalRestrictions: true,
    });
    expect(payload.inscriptionMarks?.[0]).not.toHaveProperty("localId");
  });
});
