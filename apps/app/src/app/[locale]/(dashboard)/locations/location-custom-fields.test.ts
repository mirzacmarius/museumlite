import { describe, expect, test } from "vitest";

import {
  getNumericCustomFieldValue,
  hasCustomFieldValues,
  setOptionalNumberCustomField,
} from "./location-custom-fields";

describe("location custom fields", () => {
  test("reads numeric custom field values as strings", () => {
    expect(
      getNumericCustomFieldValue(
        { vitrineCount: 4, notes: "ignored" },
        "vitrineCount",
      ),
    ).toBe("4");
    expect(
      getNumericCustomFieldValue({ vitrineCount: "4" }, "vitrineCount"),
    ).toBe("");
  });

  test("sets and clears optional number custom fields", () => {
    const customFields = {
      wallCount: 3,
    };

    setOptionalNumberCustomField(customFields, "wallCount", "6");
    setOptionalNumberCustomField(
      customFields,
      "temperature",
      "21.5",
      Number.parseFloat,
    );
    setOptionalNumberCustomField(customFields, "wallCount", "");

    expect(customFields).toEqual({
      temperature: 21.5,
    });
  });

  test("detects whether any custom field values remain", () => {
    expect(hasCustomFieldValues({})).toBe(false);
    expect(hasCustomFieldValues({ shelfCount: 12 })).toBe(true);
  });
});
