import { describe, expect, it } from "vitest";
import {
  createWebLocaleCookieOptions,
  formatWebMessage,
  locales,
  resolveWebLocale,
  webMessages,
} from "./messages";

describe("web locale messages", () => {
  it("has complete key parity and matching interpolation placeholders", () => {
    const englishKeys = Object.keys(webMessages.en).sort();

    for (const locale of locales) {
      expect(Object.keys(webMessages[locale]).sort()).toEqual(englishKeys);

      for (const key of englishKeys) {
        const englishPlaceholders =
          webMessages.en[key as keyof typeof webMessages.en].match(
            /\{\w+\}/g,
          ) ?? [];
        const localePlaceholders =
          webMessages[locale][
            key as keyof (typeof webMessages)[typeof locale]
          ].match(/\{\w+\}/g) ?? [];
        expect(localePlaceholders.sort(), `${locale}.${key}`).toEqual(
          englishPlaceholders.sort(),
        );
        expect(
          webMessages[locale][key as keyof typeof webMessages.en].trim(),
        ).not.toBe("");
      }
    }
  });

  it("formats supplied values and preserves placeholders without values", () => {
    expect(
      formatWebMessage("{count} items in {name}", {
        count: 3,
        name: "Gallery",
      }),
    ).toBe("3 items in Gallery");
    expect(formatWebMessage("{count} items in {name}", { count: 3 })).toBe(
      "3 items in {name}",
    );
  });

  it("uses English for unsupported or absent persisted locale values", () => {
    expect(resolveWebLocale("fr")).toBe("fr");
    expect(resolveWebLocale(undefined)).toBe("en");
    expect(resolveWebLocale("xx")).toBe("en");
  });

  it("creates host-only locale cookie options with validated values", () => {
    expect(createWebLocaleCookieOptions("fr")).toEqual({
      name: "museumlite-web-locale",
      value: "fr",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    expect(createWebLocaleCookieOptions("unsupported").value).toBe("en");
    expect("domain" in createWebLocaleCookieOptions("fr")).toBe(false);
  });
});
